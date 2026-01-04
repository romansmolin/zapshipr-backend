import { Worker, type Job } from 'bullmq'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { redisConnection } from '../../scheduler/redis'
import type { ILogger } from '@/shared/logger/logger.interface'
import { schema } from '@/db/schema'
import type { IInspirationWorker, InspirationJobData } from './inspiration-worker.interface'
import type { IContentParserService } from '@/modules/inspiration/services/content-parser/content-parser-service.interface'
import type { ILLMExtractionService } from '@/modules/inspiration/services/llm-extraction/llm-extraction-service.interface'
import type { IInspirationsRepository } from '@/modules/inspiration/repositories/inspirations-repository.interface'
import type { IInspirationsExtractionRepository } from '@/modules/inspiration/repositories/inspirations-extraction-repository.interface'
import type { IWorkspaceTagsRepository } from '@/modules/inspiration/repositories/workspace-tags-repository.interface'
import { buildInspirationMetadataSource } from '@/modules/inspiration/utils/inspiration-metadata'
import type { InspirationMetadata } from '@/modules/inspiration/entity/raw-inspiration.schema'

export class BullMqInspirationWorker implements IInspirationWorker {
    private worker: Worker<InspirationJobData>

    constructor(
        private readonly logger: ILogger,
        private readonly db: NodePgDatabase<typeof schema>,
        private readonly inspirationsRepository: IInspirationsRepository,
        private readonly extractionsRepository: IInspirationsExtractionRepository,
        private readonly tagsRepository: IWorkspaceTagsRepository,
        private readonly contentParser: IContentParserService,
        private readonly llmExtraction: ILLMExtractionService
    ) {
        this.worker = new Worker<InspirationJobData>('inspirations-process', async (job) => this.handleJob(job), {
            connection: redisConnection,
            concurrency: 2, // Обрабатываем по 2 inspiration одновременно
            settings: {
                backoffStrategy: this.customBackoffStrategy.bind(this),
            },
        })

        this.setupEventListeners()
    }

    start(): void {
        this.logger.info('Inspiration worker started', {
            operation: 'BullMqInspirationWorker.start',
            queueName: 'inspirations-process',
        })
    }

    async stop(): Promise<void> {
        await this.worker.close()
        this.logger.info('Inspiration worker stopped', {
            operation: 'BullMqInspirationWorker.stop',
        })
    }

    private async handleJob(job: Job<InspirationJobData>): Promise<void> {
        const { inspirationId, workspaceId, userId } = job.data

        this.logger.info('Processing inspiration job', {
            operation: 'BullMqInspirationWorker.handleJob',
            jobId: job.id,
            inspirationId,
            workspaceId,
            attempt: job.attemptsMade + 1,
        })

        // Step 1: Получить inspiration из БД
        const inspiration = await this.inspirationsRepository.findById(inspirationId)

        if (!inspiration) {
            throw new Error(`Inspiration not found: ${inspirationId}`)
        }

        // Step 2: Парсинг контента
        let parsedContent = ''
        let metadata: InspirationMetadata = { source: 'external' }

        if (inspiration.type === 'link') {
            const parsed = await this.contentParser.parseUrl(inspiration.content!)
            parsedContent = parsed.content
            const sourceMetadata = buildInspirationMetadataSource(inspiration.type, inspiration.content ?? undefined)
            metadata = {
                title: parsed.title,
                description: parsed.description,
                author: parsed.author,
                domain: parsed.domain,
                publishedDate: parsed.publishedDate,
                thumbnailUrl: parsed.thumbnailUrl,
                ...sourceMetadata,
            }
        } else if (inspiration.type === 'document') {
            // Для документов контент уже должен быть распарсен и сохранен в S3
            // Здесь мы просто используем его
            parsedContent = inspiration.content || ''
            metadata = buildInspirationMetadataSource(inspiration.type, inspiration.content ?? undefined)
        } else if (inspiration.type === 'text') {
            parsedContent = inspiration.content || ''
            metadata = buildInspirationMetadataSource(inspiration.type, inspiration.content ?? undefined)
        } else if (inspiration.type === 'image') {
            // Для изображений используем описание пользователя
            parsedContent = inspiration.userDescription || 'Image inspiration'
            metadata = buildInspirationMetadataSource(inspiration.type, inspiration.content ?? undefined)
        }

        // Step 3: Сохранить parsedContent и metadata в БД
        await this.inspirationsRepository.update(inspirationId, {
            parsedContent: this.contentParser.normalizeContent(parsedContent),
            metadata,
        })

        this.logger.info('Content parsed successfully', {
            operation: 'BullMqInspirationWorker.handleJob',
            inspirationId,
            contentLength: parsedContent.length,
        })

        // Step 4: Создать extraction через LLM
        const extractionResult = await this.llmExtraction.createExtraction({
            type: inspiration.type,
            content: parsedContent,
            userDescription: inspiration.userDescription || undefined,
            metadata,
            imageUrl: inspiration.type === 'image' ? inspiration.imageUrl || undefined : undefined,
        })

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
        })

        this.logger.info('Extraction created successfully', {
            operation: 'BullMqInspirationWorker.handleJob',
            inspirationId,
            extractionId: extraction.id,
            tokensUsed: extractionResult.tokensUsed,
        })

        // Step 6: Обновить workspace tags
        await this.updateWorkspaceTags(workspaceId, extractionResult.extraction.suggestedTags)

        // Step 7: Обновить статус на "completed"
        await this.inspirationsRepository.update(inspirationId, {
            status: 'completed',
            errorMessage: null,
        })

        this.logger.info('Inspiration processing completed', {
            operation: 'BullMqInspirationWorker.handleJob',
            jobId: job.id,
            inspirationId,
        })
    }

    private async updateWorkspaceTags(workspaceId: string, suggestedTags: string[]): Promise<void> {
        // Создаем/обновляем теги на основе suggestedTags
        for (const tagName of suggestedTags) {
            // Проверяем, существует ли тег
            const existingTag = await this.tagsRepository.findByNameAndCategory(
                workspaceId,
                tagName.toLowerCase(),
                'other' // По умолчанию категория "other"
            )

            if (existingTag) {
                // Увеличиваем usage count
                await this.tagsRepository.incrementUsageCount(existingTag.id)
            } else {
                // Создаем новый тег
                await this.tagsRepository.create({
                    workspaceId,
                    name: tagName.toLowerCase(),
                    category: 'other',
                    isUserCreated: false,
                })
            }
        }

        this.logger.info('Updated workspace tags', {
            operation: 'BullMqInspirationWorker.updateWorkspaceTags',
            workspaceId,
            tagsCount: suggestedTags.length,
        })
    }

    private setupEventListeners(): void {
        this.worker.on('completed', (job) => {
            this.logger.info('Job completed', {
                operation: 'BullMqInspirationWorker.completed',
                jobId: job.id,
                inspirationId: job.data.inspirationId,
            })
        })

        this.worker.on('failed', async (job, err) => {
            this.logger.error('Job failed', {
                operation: 'BullMqInspirationWorker.failed',
                jobId: job?.id,
                inspirationId: job?.data.inspirationId,
                error: err.message,
                attempt: job?.attemptsMade,
            })

            // Обновить статус inspiration на "failed"
            if (job) {
                await this.inspirationsRepository.update(job.data.inspirationId, {
                    status: 'failed',
                    errorMessage: err.message,
                })
            }
        })

        this.worker.on('error', (err) => {
            this.logger.error('Worker error', {
                operation: 'BullMqInspirationWorker.error',
                error: err.message,
            })
        })
    }

    private customBackoffStrategy(attemptsMade: number): number {
        // Exponential backoff: 2^attempt * 1000ms
        // Attempt 1: 2s, Attempt 2: 4s, Attempt 3: 8s
        return Math.pow(2, attemptsMade) * 1000
    }
}
