import path from 'path'

import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import type { IInspirationScheduler } from '@/shared/queue/scheduler/inspiration-scheduler/inspiration-scheduler.interface'
import type { IContentParserService } from '@/modules/inspiration/services/content-parser/content-parser-service.interface'

import type {
    IInspirationsRepository,
    InspirationWithExtraction,
} from '../repositories/inspirations-repository.interface'
import type {
    IInspirationsService,
    CreateInspirationData,
    GetInspirationsFilters,
    InspirationsListResponse,
    TriggerExtractionOptions,
    TriggerExtractionResult,
} from './inspirations-service.interface'
import type { RawInspiration } from '../entity/raw-inspiration.schema'
import {
    getThumbnailFromMarkdown,
    getThumbnailFromPdf,
    getThumbnailFromTxt,
    type ThumbnailResult,
} from '../utils/document-thumbnails'
import { validateInspirationByType } from '../validation/inspirations.schemas'

export class InspirationsService implements IInspirationsService {
    constructor(
        private readonly inspirationsRepository: IInspirationsRepository,
        private readonly mediaUploader: IMediaUploader,
        private readonly inspirationScheduler: IInspirationScheduler,
        private readonly contentParser: IContentParserService,
        private readonly logger: ILogger
    ) {}

    async createInspiration(data: CreateInspirationData): Promise<RawInspiration> {
        if (data.type === 'link' || data.type === 'text')
            validateInspirationByType({ type: data.type, content: data.content })

        if (data.type === 'link' && data.content) {
            const isDuplicate = await this.inspirationsRepository.checkDuplicateUrl(data.workspaceId, data.content)

            if (isDuplicate) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.DUPLICATE_INSPIRATION,
                    message: 'This URL already exists in your inspirations',
                    httpCode: 409,
                })
            }
        }

        let imageUrl: string | undefined
        let uploadedFileUrl: string | undefined
        let parsedDocumentContent: string | undefined

        if (data.file && (data.type === 'image' || data.type === 'document')) {
            const timestamp = Date.now()
            const fileName = `${data.workspaceId}/${data.type}s/${timestamp}-${data.file.originalname}`

            uploadedFileUrl = await this.mediaUploader.upload({
                key: fileName,
                body: data.file.buffer,
                contentType: data.file.mimetype,
            })

            imageUrl = uploadedFileUrl

            this.logger.info('Uploaded inspiration file to S3', {
                operation: 'InspirationsService.createInspiration',
                workspaceId: data.workspaceId,
                type: data.type,
                imageUrl: uploadedFileUrl,
            })

            if (data.type === 'document') {
                const parsed = await this.contentParser.parseDocument(data.file.buffer, data.file.originalname)
                parsedDocumentContent = parsed.content

                const thumbnail = await this.createDocumentThumbnail(data.file, parsedDocumentContent, data.title)
                if (thumbnail) {
                    const thumbnailKey = this.buildDocumentThumbnailKey(
                        data.workspaceId,
                        timestamp,
                        data.file.originalname,
                        thumbnail.extension
                    )
                    const thumbnailUrl = await this.mediaUploader.upload({
                        key: thumbnailKey,
                        body: thumbnail.buffer,
                        contentType: thumbnail.contentType,
                    })
                    imageUrl = thumbnailUrl

                    this.logger.info('Uploaded document thumbnail to S3', {
                        operation: 'InspirationsService.createInspiration',
                        workspaceId: data.workspaceId,
                        type: data.type,
                        thumbnailUrl,
                    })
                }
            }
        }

        const inspiration = await this.inspirationsRepository.create({
            workspaceId: data.workspaceId,
            userId: data.userId,
            type: data.type,
            title: data.title,
            content: data.type === 'document' ? parsedDocumentContent : data.content,
            parsedContent: data.type === 'document' ? parsedDocumentContent : undefined,
            imageUrl,
            userDescription: data.userDescription,
            status: 'processing',
        })

        this.logger.info('Created inspiration', {
            operation: 'InspirationsService.createInspiration',
            inspirationId: inspiration.id,
            workspaceId: data.workspaceId,
            type: data.type,
        })

        await this.inspirationScheduler.scheduleInspiration(inspiration.id, data.workspaceId, data.userId)

        this.logger.info('Scheduled inspiration for processing', {
            operation: 'InspirationsService.createInspiration',
            inspirationId: inspiration.id,
        })

        return inspiration
    }

    async getInspirations(
        workspaceId: string,
        filters?: GetInspirationsFilters
    ): Promise<InspirationsListResponse> {
        const { items, total } = await this.inspirationsRepository.findByWorkspaceId(workspaceId, filters)

        this.logger.info('Inspiration fetched successfully: ', { items, total })

        return {
            items,
            total,
            limit: filters?.limit ?? 20,
            offset: filters?.offset ?? 0,
        }
    }

    async getInspirationById(id: string): Promise<InspirationWithExtraction | null> {
        const inspiration = await this.inspirationsRepository.findByIdWithExtraction(id)

        return inspiration ?? null
    }

    async updateInspiration(id: string, userDescription: string): Promise<RawInspiration | null> {
        const inspiration = await this.inspirationsRepository.findById(id)

        if (!inspiration) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        const updated = await this.inspirationsRepository.update(id, { userDescription })

        this.logger.info('Updated inspiration', {
            operation: 'InspirationsService.updateInspiration',
            inspirationId: id,
        })

        return updated ?? null
    }

    async deleteInspiration(id: string): Promise<boolean> {
        const inspiration = await this.inspirationsRepository.findById(id)

        if (!inspiration) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        if (inspiration.imageUrl) {
            try {
                await this.mediaUploader.delete(inspiration.imageUrl)
                this.logger.info('Deleted inspiration file from S3', {
                    operation: 'InspirationsService.deleteInspiration',
                    inspirationId: id,
                    imageUrl: inspiration.imageUrl,
                })
            } catch (error) {
                this.logger.warn('Failed to delete file from S3, continuing with DB deletion', {
                    operation: 'InspirationsService.deleteInspiration',
                    inspirationId: id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        const deleted = await this.inspirationsRepository.delete(id)

        this.logger.info('Deleted inspiration', {
            operation: 'InspirationsService.deleteInspiration',
            inspirationId: id,
        })

        return deleted
    }

    async retryInspiration(id: string, workspaceId: string, userId: string): Promise<RawInspiration> {
        const inspiration = await this.inspirationsRepository.findById(id)

        if (!inspiration) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        if (inspiration.status !== 'failed') {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'Only failed inspirations can be retried',
                httpCode: 400,
            })
        }

        const updated = await this.inspirationsRepository.update(id, {
            status: 'processing',
            errorMessage: null,
        })

        if (!updated) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Failed to update inspiration',
                httpCode: 500,
            })
        }

        await this.inspirationScheduler.scheduleInspiration(id, workspaceId, userId)

        this.logger.info('Retried inspiration processing', {
            operation: 'InspirationsService.retryInspiration',
            inspirationId: id,
            workspaceId,
            userId,
        })

        return updated
    }

    async triggerExtraction(
        id: string,
        workspaceId: string,
        userId: string,
        options?: TriggerExtractionOptions
    ): Promise<TriggerExtractionResult> {
        const inspiration = await this.inspirationsRepository.findById(id)

        if (!inspiration) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        // Check ownership
        if (inspiration.workspaceId !== workspaceId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.FORBIDDEN,
                message: 'Inspiration does not belong to this workspace',
                httpCode: 403,
            })
        }

        // Check if already processing
        const processingStatuses = ['processing', 'transcript_fetching', 'extracting']
        if (processingStatuses.includes(inspiration.status)) {
            return {
                status: 'already_processing',
                inspirationId: id,
                message: `Inspiration is currently ${inspiration.status}`,
            }
        }

        // Valid statuses for triggering extraction
        const validStatuses = ['transcript_ready', 'completed', 'failed']
        if (!validStatuses.includes(inspiration.status)) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: `Cannot trigger extraction for inspiration with status ${inspiration.status}. Valid statuses: ${validStatuses.join(', ')}`,
                httpCode: 400,
            })
        }

        // Reset status based on current state
        let newStatus: 'processing' | 'extracting' = 'processing'
        if (inspiration.status === 'transcript_ready') {
            newStatus = 'extracting'
        }

        await this.inspirationsRepository.update(id, {
            status: newStatus,
            errorMessage: null,
        })

        // Schedule for processing
        await this.inspirationScheduler.scheduleInspiration(id, workspaceId, userId)

        this.logger.info('Triggered extraction for inspiration', {
            operation: 'InspirationsService.triggerExtraction',
            inspirationId: id,
            workspaceId,
            userId,
            previousStatus: inspiration.status,
            newStatus,
            forceRefresh: options?.forceRefresh,
        })

        return {
            status: 'queued',
            inspirationId: id,
            message: `Extraction queued successfully. Previous status: ${inspiration.status}`,
        }
    }

    private async createDocumentThumbnail(
        file: Express.Multer.File,
        parsedContent: string | undefined,
        title: string
    ): Promise<ThumbnailResult | null> {
        const extension = this.getDocumentExtension(file)

        if (extension === 'pdf') {
            return getThumbnailFromPdf(file.buffer, { title })
        }

        if (extension === 'md') {
            return getThumbnailFromMarkdown(parsedContent ?? '', { title })
        }

        if (extension === 'txt') {
            return getThumbnailFromTxt(parsedContent ?? '', { title })
        }

        return null
    }

    private getDocumentExtension(file: Express.Multer.File): 'pdf' | 'md' | 'txt' | null {
        const extension = path.extname(file.originalname).replace('.', '').toLowerCase()

        if (extension === 'pdf' || extension === 'md' || extension === 'txt') {
            return extension
        }

        if (file.mimetype === 'application/pdf') return 'pdf'
        if (file.mimetype === 'text/markdown' || file.mimetype === 'text/x-markdown') return 'md'
        if (file.mimetype === 'text/plain') return 'txt'

        return null
    }

    private buildDocumentThumbnailKey(
        workspaceId: string,
        timestamp: number,
        originalName: string,
        extension: string
    ): string {
        const baseName = path.parse(originalName).name
        const safeBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'

        return `${workspaceId}/documents/thumbnails/${timestamp}-${safeBaseName}.${extension}`
    }
}
