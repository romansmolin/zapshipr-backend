"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMqInspirationWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../../scheduler/redis");
const inspiration_metadata_1 = require("@/modules/inspiration/utils/inspiration-metadata");
class BullMqInspirationWorker {
    constructor(logger, db, inspirationsRepository, extractionsRepository, tagsRepository, contentParser, llmExtraction) {
        this.logger = logger;
        this.db = db;
        this.inspirationsRepository = inspirationsRepository;
        this.extractionsRepository = extractionsRepository;
        this.tagsRepository = tagsRepository;
        this.contentParser = contentParser;
        this.llmExtraction = llmExtraction;
        this.worker = new bullmq_1.Worker('inspirations-process', async (job) => this.handleJob(job), {
            connection: redis_1.redisConnection,
            concurrency: 2, // Обрабатываем по 2 inspiration одновременно
            settings: {
                backoffStrategy: this.customBackoffStrategy.bind(this),
            },
        });
        this.setupEventListeners();
    }
    start() {
        this.logger.info('Inspiration worker started', {
            operation: 'BullMqInspirationWorker.start',
            queueName: 'inspirations-process',
        });
    }
    async stop() {
        await this.worker.close();
        this.logger.info('Inspiration worker stopped', {
            operation: 'BullMqInspirationWorker.stop',
        });
    }
    async handleJob(job) {
        const { inspirationId, workspaceId, userId } = job.data;
        this.logger.info('Processing inspiration job', {
            operation: 'BullMqInspirationWorker.handleJob',
            jobId: job.id,
            inspirationId,
            workspaceId,
            attempt: job.attemptsMade + 1,
        });
        // Step 1: Получить inspiration из БД
        const inspiration = await this.inspirationsRepository.findById(inspirationId);
        if (!inspiration) {
            throw new Error(`Inspiration not found: ${inspirationId}`);
        }
        // Step 2: Парсинг контента
        let parsedContent = '';
        const baseMetadata = (0, inspiration_metadata_1.buildInspirationMetadataSource)(inspiration.type, inspiration.content || undefined);
        let metadata = baseMetadata;
        if (inspiration.type === 'link') {
            const parsed = await this.contentParser.parseUrl(inspiration.content);
            parsedContent = parsed.content;
            metadata = {
                ...baseMetadata,
                title: parsed.title,
                description: parsed.description,
                author: parsed.author,
                domain: parsed.domain,
                publishedDate: parsed.publishedDate,
            };
        }
        else if (inspiration.type === 'document') {
            // Для документов контент уже должен быть распарсен и сохранен в S3
            // Здесь мы просто используем его
            parsedContent = inspiration.content || '';
        }
        else if (inspiration.type === 'text') {
            parsedContent = inspiration.content || '';
        }
        else if (inspiration.type === 'image') {
            // Для изображений используем описание пользователя
            parsedContent = inspiration.userDescription || 'Image inspiration';
        }
        // Step 3: Сохранить parsedContent и metadata в БД
        await this.inspirationsRepository.update(inspirationId, {
            parsedContent: this.contentParser.normalizeContent(parsedContent),
            metadata,
        });
        this.logger.info('Content parsed successfully', {
            operation: 'BullMqInspirationWorker.handleJob',
            inspirationId,
            contentLength: parsedContent.length,
        });
        // Step 4: Создать extraction через LLM
        const extractionResult = await this.llmExtraction.createExtraction({
            type: inspiration.type,
            content: parsedContent,
            userDescription: inspiration.userDescription || undefined,
            metadata,
        });
        // Step 5: Сохранить extraction в БД
        const extraction = await this.extractionsRepository.create({
            rawInspirationId: inspirationId,
            workspaceId,
            summary: extractionResult.extraction.summary,
            keyTopics: extractionResult.extraction.keyTopics,
            contentFormat: extractionResult.extraction.contentFormat,
            tone: extractionResult.extraction.tone,
            targetAudience: extractionResult.extraction.targetAudience,
            keyInsights: extractionResult.extraction.keyInsights,
            contentStructure: extractionResult.extraction.contentStructure,
            visualStyle: extractionResult.extraction.visualStyle || null,
            suggestedTags: extractionResult.extraction.suggestedTags,
            llmModel: extractionResult.llmModel,
            tokensUsed: extractionResult.tokensUsed,
        });
        this.logger.info('Extraction created successfully', {
            operation: 'BullMqInspirationWorker.handleJob',
            inspirationId,
            extractionId: extraction.id,
            tokensUsed: extractionResult.tokensUsed,
        });
        // Step 6: Обновить workspace tags
        await this.updateWorkspaceTags(workspaceId, extractionResult.extraction.suggestedTags);
        // Step 7: Обновить статус на "completed"
        await this.inspirationsRepository.update(inspirationId, {
            status: 'completed',
            errorMessage: null,
        });
        this.logger.info('Inspiration processing completed', {
            operation: 'BullMqInspirationWorker.handleJob',
            jobId: job.id,
            inspirationId,
        });
    }
    async updateWorkspaceTags(workspaceId, suggestedTags) {
        // Создаем/обновляем теги на основе suggestedTags
        for (const tagName of suggestedTags) {
            // Проверяем, существует ли тег
            const existingTag = await this.tagsRepository.findByNameAndCategory(workspaceId, tagName.toLowerCase(), 'other' // По умолчанию категория "other"
            );
            if (existingTag) {
                // Увеличиваем usage count
                await this.tagsRepository.incrementUsageCount(existingTag.id);
            }
            else {
                // Создаем новый тег
                await this.tagsRepository.create({
                    workspaceId,
                    name: tagName.toLowerCase(),
                    category: 'other',
                    isUserCreated: false,
                });
            }
        }
        this.logger.info('Updated workspace tags', {
            operation: 'BullMqInspirationWorker.updateWorkspaceTags',
            workspaceId,
            tagsCount: suggestedTags.length,
        });
    }
    setupEventListeners() {
        this.worker.on('completed', (job) => {
            this.logger.info('Job completed', {
                operation: 'BullMqInspirationWorker.completed',
                jobId: job.id,
                inspirationId: job.data.inspirationId,
            });
        });
        this.worker.on('failed', async (job, err) => {
            this.logger.error('Job failed', {
                operation: 'BullMqInspirationWorker.failed',
                jobId: job?.id,
                inspirationId: job?.data.inspirationId,
                error: err.message,
                attempt: job?.attemptsMade,
            });
            // Обновить статус inspiration на "failed"
            if (job) {
                await this.inspirationsRepository.update(job.data.inspirationId, {
                    status: 'failed',
                    errorMessage: err.message,
                });
            }
        });
        this.worker.on('error', (err) => {
            this.logger.error('Worker error', {
                operation: 'BullMqInspirationWorker.error',
                error: err.message,
            });
        });
    }
    customBackoffStrategy(attemptsMade) {
        // Exponential backoff: 2^attempt * 1000ms
        // Attempt 1: 2s, Attempt 2: 4s, Attempt 3: 8s
        return Math.pow(2, attemptsMade) * 1000;
    }
}
exports.BullMqInspirationWorker = BullMqInspirationWorker;
