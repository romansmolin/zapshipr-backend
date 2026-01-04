import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import type { IInspirationScheduler } from '@/shared/queue/scheduler/inspiration-scheduler/inspiration-scheduler.interface'

import type { IInspirationsRepository } from '../repositories/inspirations-repository.interface'
import type { IContentParserService } from './content-parser/content-parser-service.interface'
import type {
    IInspirationsService,
    CreateInspirationData,
    GetInspirationsFilters,
    InspirationsListResponse,
} from './inspirations-service.interface'
import type { RawInspiration } from '../entity/raw-inspiration.schema'
import type { InspirationWithExtraction } from '../entity/inspiration-with-extraction'
import { validateInspirationByType } from '../validation/inspirations.schemas'
import { buildInspirationMetadataSource } from '../utils/inspiration-metadata'

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
        let parsedDocumentContent: string | undefined

        if (data.file && (data.type === 'image' || data.type === 'document')) {
            const timestamp = Date.now()
            const fileName = `${data.workspaceId}/${data.type}s/${timestamp}-${data.file.originalname}`

            imageUrl = await this.mediaUploader.upload({
                key: fileName,
                body: data.file.buffer,
                contentType: data.file.mimetype,
            })

            this.logger.info('Uploaded inspiration file to S3', {
                operation: 'InspirationsService.createInspiration',
                workspaceId: data.workspaceId,
                type: data.type,
                imageUrl,
            })

            if (data.type === 'document') {
                const parsedDocument = await this.contentParser.parseDocument(
                    data.file.buffer,
                    data.file.originalname
                )
                parsedDocumentContent = parsedDocument.content
            }
        }

        const metadata = buildInspirationMetadataSource(data.type, data.content)

        const inspiration = await this.inspirationsRepository.create({
            workspaceId: data.workspaceId,
            userId: data.userId,
            type: data.type,
            title: data.title,
            content: data.type === 'document' ? parsedDocumentContent ?? data.content : data.content,
            imageUrl,
            userDescription: data.userDescription,
            metadata,
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
        const { items, total } = await this.inspirationsRepository.findByWorkspaceIdWithExtraction(
            workspaceId,
            filters
        )

        return {
            items,
            total,
            limit: filters?.limit ?? 20,
            offset: filters?.offset ?? 0,
        }
    }

    async getInspirationById(id: string, workspaceId: string): Promise<InspirationWithExtraction | null> {
        const inspiration = await this.inspirationsRepository.findByIdWithExtraction(id)

        if (!inspiration) {
            return null
        }

        if (inspiration.workspaceId !== workspaceId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        return inspiration
    }

    async updateInspiration(
        id: string,
        workspaceId: string,
        userDescription: string
    ): Promise<RawInspiration | null> {
        const inspiration = await this.inspirationsRepository.findById(id)

        if (!inspiration) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        if (inspiration.workspaceId !== workspaceId) {
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
            workspaceId,
        })

        return updated ?? null
    }

    async deleteInspiration(id: string, workspaceId: string): Promise<boolean> {
        const inspiration = await this.inspirationsRepository.findById(id)

        if (!inspiration) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        if (inspiration.workspaceId !== workspaceId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        // Удаление файла из S3 (если есть)
        if (inspiration.imageUrl) {
            try {
                await this.mediaUploader.delete(inspiration.imageUrl)
                this.logger.info('Deleted inspiration file from S3', {
                    operation: 'InspirationsService.deleteInspiration',
                    inspirationId: id,
                    imageUrl: inspiration.imageUrl,
                })
            } catch (error) {
                // Ошибка удаления из S3 не должна блокировать удаление из БД
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
            workspaceId,
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

        if (inspiration.workspaceId !== workspaceId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            })
        }

        const updated = await this.inspirationsRepository.update(id, {
            status: 'processing',
            errorMessage: null,
        })

        if (!updated) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
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
}
