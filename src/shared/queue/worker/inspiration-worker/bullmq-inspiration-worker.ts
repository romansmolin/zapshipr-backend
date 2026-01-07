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
import type { InspirationMetadata } from '@/modules/inspiration/entity/raw-inspiration.schema'
import { buildInspirationMetadataSource } from '@/modules/inspiration/utils/inspiration-metadata'

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
            concurrency: 2,
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
        const { inspirationId, workspaceId } = job.data

        this.logger.info('Processing inspiration job', {
            operation: 'BullMqInspirationWorker.handleJob',
            jobId: job.id,
            inspirationId,
            workspaceId,
            attempt: job.attemptsMade + 1,
        })

        const inspiration = await this.inspirationsRepository.findById(inspirationId)

        if (!inspiration) throw new Error(`Inspiration not found: ${inspirationId}`)

        let parsedContent = ''
        let thumbnailUrl: string | undefined

        const baseMetadata = buildInspirationMetadataSource(inspiration.type, inspiration.content || undefined)

        let metadata: InspirationMetadata = baseMetadata

        if (inspiration.type === 'link') {
            const parsed = await this.contentParser.parseUrl(inspiration.content!)
            parsedContent = parsed.content
            thumbnailUrl = parsed.thumbnailUrl
            metadata = {
                ...baseMetadata,
                title: parsed.title,
                description: parsed.description,
                author: parsed.author,
                domain: parsed.domain,
                publishedDate: parsed.publishedDate,
                thumbnailUrl: parsed.thumbnailUrl,
            }
        } else if (inspiration.type === 'document') {
            parsedContent = inspiration.content || ''
        } else if (inspiration.type === 'text') {
            parsedContent = inspiration.content || ''
        } else if (inspiration.type === 'image') {
            parsedContent = inspiration.userDescription || ''
        }

        // Update inspiration with parsed content, metadata, and thumbnail
        const updateData: Record<string, unknown> = {
            parsedContent: this.contentParser.normalizeContent(parsedContent),
            metadata,
        }

        // Save thumbnail URL for links (if not already has imageUrl)
        if (thumbnailUrl && !inspiration.imageUrl) {
            updateData.imageUrl = thumbnailUrl
        }

        await this.inspirationsRepository.update(inspirationId, updateData)

        this.logger.info('Content parsed successfully', {
            operation: 'BullMqInspirationWorker.handleJob',
            inspirationId,
            contentLength: parsedContent.length,
            hasThumbnail: !!thumbnailUrl,
            thumbnailUrl: thumbnailUrl?.substring(0, 100),
        })

        // Determine imageUrl for Vision analysis
        // For images: use the uploaded image
        // For links: use thumbnail if available
        const imageUrlForVision =
            inspiration.type === 'image'
                ? inspiration.imageUrl || undefined
                : thumbnailUrl || undefined

        const extractionResult = await this.llmExtraction.createExtraction({
            type: inspiration.type,
            content: parsedContent,
            userDescription: inspiration.userDescription || undefined,
            imageUrl: imageUrlForVision,
            metadata,
        })

        const formattedPostIdeas = extractionResult.extraction.postIdeas.map(
            (idea) => `[${idea.format.toUpperCase()}] ${idea.idea} | Angle: ${idea.angle}`
        )

        const extraction = await this.extractionsRepository.create({
            rawInspirationId: inspirationId,
            workspaceId,
            summary: extractionResult.extraction.summary,
            keyTopics: extractionResult.extraction.keyTopics,
            contentFormat: extractionResult.extraction.contentFormat,
            tone: extractionResult.extraction.tone,
            targetAudience: extractionResult.extraction.targetAudience,
            keyInsights: extractionResult.extraction.keyInsights,
            postIdeas: formattedPostIdeas,
            contentStructure: extractionResult.extraction.contentStructure,
            visualStyle: extractionResult.extraction.visualStyle || null,
            suggestedTags: extractionResult.extraction.suggestedTags,
            llmModel: extractionResult.llmModel,
            tokensUsed: extractionResult.tokensUsed,
        })

        this.logger.info('Extraction created', {
            operation: 'BullMqInspirationWorker.handleJob',
            inspirationId,
            extractionId: extraction.id,
            tokensUsed: extractionResult.tokensUsed,
        })

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
        for (const tagName of suggestedTags) {
            const existingTag = await this.tagsRepository.findByNameAndCategory(
                workspaceId,
                tagName.toLowerCase(),
                'other'
            )

            if (existingTag) {
                await this.tagsRepository.incrementUsageCount(existingTag.id)
            } else {
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
        return Math.pow(2, attemptsMade) * 1000
    }
}
