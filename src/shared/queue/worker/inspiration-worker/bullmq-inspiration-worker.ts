import { Worker, type Job } from 'bullmq'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { redisConnection } from '../../scheduler/redis'
import type { ILogger } from '@/shared/logger/logger.interface'
import { schema } from '@/db/schema'
import type { IInspirationWorker, InspirationJobData } from './inspiration-worker.interface'
import type { IContentParserService } from '@/modules/inspiration/services/content-parser/content-parser-service.interface'
import type { ILLMExtractionService } from '@/modules/inspiration/services/llm-extraction/llm-extraction-service.interface'
import type { IContentDetectionService } from '@/modules/inspiration/services/content-detection/content-detection-service.interface'
import type { IBookIdentificationService } from '@/modules/inspiration/services/book-identification/book-identification-service.interface'
import type { IInspirationsRepository } from '@/modules/inspiration/repositories/inspirations-repository.interface'
import type { IInspirationsExtractionRepository } from '@/modules/inspiration/repositories/inspirations-extraction-repository.interface'
import type { IBookExtractionRepository } from '@/modules/inspiration/repositories/book-extraction-repository.interface'
import type { IWorkspaceTagsRepository } from '@/modules/inspiration/repositories/workspace-tags-repository.interface'
import type { InspirationMetadata, DetectedContentCategory } from '@/modules/inspiration/entity/raw-inspiration.schema'
import { buildInspirationMetadataSource } from '@/modules/inspiration/utils/inspiration-metadata'

export class BullMqInspirationWorker implements IInspirationWorker {
    private worker: Worker<InspirationJobData>

    constructor(
        private readonly logger: ILogger,
        private readonly db: NodePgDatabase<typeof schema>,
        private readonly inspirationsRepository: IInspirationsRepository,
        private readonly extractionsRepository: IInspirationsExtractionRepository,
        private readonly bookExtractionsRepository: IBookExtractionRepository,
        private readonly tagsRepository: IWorkspaceTagsRepository,
        private readonly contentParser: IContentParserService,
        private readonly llmExtraction: ILLMExtractionService,
        private readonly contentDetection: IContentDetectionService,
        private readonly bookIdentification: IBookIdentificationService
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
        const baseMetadata = buildInspirationMetadataSource(inspiration.type, inspiration.content || undefined)
        let metadata: InspirationMetadata = baseMetadata

        if (inspiration.type === 'link') {
            const parsed = await this.contentParser.parseUrl(inspiration.content!)
            parsedContent = parsed.content
            metadata = {
                ...baseMetadata,
                title: parsed.title,
                description: parsed.description,
                author: parsed.author,
                domain: parsed.domain,
                publishedDate: parsed.publishedDate,
            }
        } else if (inspiration.type === 'document') {
            parsedContent = inspiration.content || ''
        } else if (inspiration.type === 'text') {
            parsedContent = inspiration.content || ''
        } else if (inspiration.type === 'image') {
            parsedContent = inspiration.userDescription || 'Image inspiration'
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

        // Step 4: Detect content type (book, article, video, etc.)
        const detectionResult = await this.contentDetection.detectContentType({
            type: inspiration.type,
            content: inspiration.type !== 'image' ? parsedContent : undefined,
            imageUrl: inspiration.imageUrl || undefined,
            userDescription: inspiration.userDescription || undefined,
            metadata: {
                title: metadata.title,
                description: metadata.description,
                author: metadata.author,
                domain: metadata.domain,
            },
        })

        this.logger.info('Content type detected', {
            operation: 'BullMqInspirationWorker.handleJob',
            inspirationId,
            detectedCategory: detectionResult.category,
            confidence: detectionResult.confidence,
        })

        // Update detected category in DB
        await this.inspirationsRepository.update(inspirationId, {
            detectedCategory: detectionResult.category,
        })

        // Step 5: Branch based on detected content type
        if (detectionResult.category === 'book' && detectionResult.confidence >= 0.6) {
            // === BOOK PROCESSING PIPELINE ===
            await this.processBookInspiration(
                inspirationId,
                workspaceId,
                inspiration,
                parsedContent,
                detectionResult.hints
            )
        } else {
            // === STANDARD PROCESSING PIPELINE ===
            await this.processStandardInspiration(inspirationId, workspaceId, inspiration, parsedContent, metadata)
        }

        // Step 6: Обновить статус на "completed"
        await this.inspirationsRepository.update(inspirationId, {
            status: 'completed',
            errorMessage: null,
        })

        this.logger.info('Inspiration processing completed', {
            operation: 'BullMqInspirationWorker.handleJob',
            jobId: job.id,
            inspirationId,
            detectedCategory: detectionResult.category,
        })
    }

    /**
     * Process inspiration as a book with deep semantic analysis
     */
    private async processBookInspiration(
        inspirationId: string,
        workspaceId: string,
        inspiration: { type: string; content?: string | null; imageUrl?: string | null; userDescription?: string | null },
        parsedContent: string,
        hints?: { possibleBookTitle?: string; possibleAuthors?: string[] }
    ): Promise<void> {
        this.logger.info('Processing as book inspiration', {
            operation: 'BullMqInspirationWorker.processBookInspiration',
            inspirationId,
        })

        // Step 1: Identify the book (Vision + Google Books API)
        const bookMetadata = await this.bookIdentification.identifyBook({
            imageUrl: inspiration.imageUrl || undefined,
            userDescription: inspiration.userDescription || undefined,
            parsedContent,
            hints,
        })

        if (!bookMetadata) {
            this.logger.warn('Could not identify book, falling back to standard processing', {
                operation: 'BullMqInspirationWorker.processBookInspiration',
                inspirationId,
            })
            // Fall back to standard processing
            const baseMetadata = buildInspirationMetadataSource(
                inspiration.type as 'image' | 'link' | 'text' | 'document',
                inspiration.content || undefined
            )
            await this.processStandardInspiration(inspirationId, workspaceId, inspiration, parsedContent, baseMetadata)
            return
        }

        // Save book metadata to inspiration
        await this.inspirationsRepository.update(inspirationId, {
            bookMetadata,
            title: bookMetadata.title.substring(0, 100), // Update title with book title
        })

        this.logger.info('Book identified', {
            operation: 'BullMqInspirationWorker.processBookInspiration',
            inspirationId,
            bookTitle: bookMetadata.title,
            authors: bookMetadata.authors,
            confidence: bookMetadata.identificationConfidence,
        })

        // Step 2: Create deep book extraction
        const bookExtractionResult = await this.llmExtraction.createBookExtraction({
            bookMetadata,
            parsedContent,
            userDescription: inspiration.userDescription || undefined,
            imageUrl: inspiration.imageUrl || undefined,
        })

        // Step 3: Save book extraction to DB
        const bookExtraction = await this.bookExtractionsRepository.create({
            rawInspirationId: inspirationId,
            workspaceId,
            title: bookMetadata.title,
            authors: bookMetadata.authors,
            isbn: bookMetadata.isbn || null,
            isbn13: bookMetadata.isbn13 || null,
            publicationYear: bookExtractionResult.extraction.identification.publicationYear || null,
            publisher: bookMetadata.publisher || null,
            genre: bookExtractionResult.extraction.identification.genre,
            category: bookExtractionResult.extraction.identification.category || null,
            language: bookMetadata.language || null,
            pageCount: bookMetadata.pageCount || null,
            identificationConfidence: bookMetadata.identificationConfidence || null,
            semanticCore: bookExtractionResult.extraction.semanticCore,
            themesAndPatterns: bookExtractionResult.extraction.themesAndPatterns,
            knowledgeConnections: bookExtractionResult.extraction.knowledgeConnections,
            contentGenerationGuidelines: bookExtractionResult.extraction.contentGenerationGuidelines,
            llmModel: bookExtractionResult.llmModel,
            tokensUsed: bookExtractionResult.tokensUsed,
            visionUsed: inspiration.imageUrl ? 1 : 0,
            externalSourcesUsed: bookMetadata.dataSource ? [bookMetadata.dataSource] : [],
            processingDurationMs: bookExtractionResult.processingDurationMs,
        })

        this.logger.info('Book extraction created', {
            operation: 'BullMqInspirationWorker.processBookInspiration',
            inspirationId,
            bookExtractionId: bookExtraction.id,
            tokensUsed: bookExtractionResult.tokensUsed,
        })

        // Step 4: Also create standard extraction for compatibility
        const standardExtractionResult = await this.llmExtraction.createExtraction({
            type: inspiration.type as 'image' | 'link' | 'text' | 'document',
            content: parsedContent,
            userDescription: inspiration.userDescription || undefined,
        })

        await this.extractionsRepository.create({
            rawInspirationId: inspirationId,
            workspaceId,
            summary: standardExtractionResult.extraction.summary,
            keyTopics: standardExtractionResult.extraction.keyTopics,
            contentFormat: 'book',
            tone: standardExtractionResult.extraction.tone,
            targetAudience: standardExtractionResult.extraction.targetAudience,
            keyInsights: standardExtractionResult.extraction.keyInsights,
            contentStructure: standardExtractionResult.extraction.contentStructure,
            visualStyle: standardExtractionResult.extraction.visualStyle || null,
            suggestedTags: standardExtractionResult.extraction.suggestedTags,
            llmModel: standardExtractionResult.llmModel,
            tokensUsed: standardExtractionResult.tokensUsed,
        })

        // Step 5: Update workspace tags from book themes
        const bookTags = [
            ...bookExtractionResult.extraction.themesAndPatterns.primaryThemes,
            ...bookExtractionResult.extraction.themesAndPatterns.secondaryThemes,
            ...bookExtractionResult.extraction.identification.genre,
            ...bookExtractionResult.extraction.contentGenerationGuidelines.hashtags.map((h) =>
                h.replace(/^#/, '')
            ),
        ]
        await this.updateWorkspaceTags(workspaceId, bookTags)
    }

    /**
     * Standard inspiration processing (non-book content)
     */
    private async processStandardInspiration(
        inspirationId: string,
        workspaceId: string,
        inspiration: { type: string; userDescription?: string | null },
        parsedContent: string,
        metadata: InspirationMetadata
    ): Promise<void> {
        // Create extraction through LLM
        const extractionResult = await this.llmExtraction.createExtraction({
            type: inspiration.type as 'image' | 'link' | 'text' | 'document',
            content: parsedContent,
            userDescription: inspiration.userDescription || undefined,
            metadata,
        })

        // Save extraction to DB
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

        this.logger.info('Standard extraction created', {
            operation: 'BullMqInspirationWorker.processStandardInspiration',
            inspirationId,
            extractionId: extraction.id,
            tokensUsed: extractionResult.tokensUsed,
        })

        // Update workspace tags
        await this.updateWorkspaceTags(workspaceId, extractionResult.extraction.suggestedTags)
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
