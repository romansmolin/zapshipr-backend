import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import type { IInspirationsRepository } from '../repositories/inspirations-repository.interface'
import type {
    IInspirationsService,
    CreateInspirationData,
    GetInspirationsFilters,
    InspirationsListResponse,
} from './inspirations-service.interface'
import type { RawInspiration } from '../entity/raw-inspiration.schema'
import { validateInspirationByType } from '../validation/inspirations.schemas'

export class InspirationsService implements IInspirationsService {
    constructor(
        private readonly inspirationsRepository: IInspirationsRepository,
        private readonly mediaUploader: IMediaUploader,
        private readonly logger: ILogger
    ) {}

    async createInspiration(data: CreateInspirationData): Promise<RawInspiration> {
        try {
            // Валидация в зависимости от типа
            if (data.type === 'link' || data.type === 'text') {
                validateInspirationByType({ type: data.type, content: data.content })
            }

            // Проверка дубликатов для ссылок
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

            // Загрузка файла в S3 (если type=image или document)
            let imageUrl: string | undefined

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
            }

            // Создание inspiration
            const inspiration = await this.inspirationsRepository.create({
                workspaceId: data.workspaceId,
                userId: data.userId,
                type: data.type,
                content: data.content,
                imageUrl,
                userDescription: data.userDescription,
                status: 'processing', // В Phase 1 можно сразу 'completed', в Phase 2 добавим worker
            })

            this.logger.info('Created inspiration', {
                operation: 'InspirationsService.createInspiration',
                inspirationId: inspiration.id,
                workspaceId: data.workspaceId,
                type: data.type,
            })

            return inspiration
        } catch (error) {
            this.logger.error('Failed to create inspiration', {
                operation: 'InspirationsService.createInspiration',
                workspaceId: data.workspaceId,
                type: data.type,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            throw error
        }
    }

    async getInspirations(workspaceId: string, filters?: GetInspirationsFilters): Promise<InspirationsListResponse> {
        try {
            const { items, total } = await this.inspirationsRepository.findByWorkspaceId(workspaceId, filters)

            return {
                items,
                total,
                limit: filters?.limit ?? 20,
                offset: filters?.offset ?? 0,
            }
        } catch (error) {
            this.logger.error('Failed to get inspirations', {
                operation: 'InspirationsService.getInspirations',
                workspaceId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            throw error
        }
    }

    async getInspirationById(id: string): Promise<RawInspiration | null> {
        try {
            const inspiration = await this.inspirationsRepository.findById(id)

            return inspiration ?? null
        } catch (error) {
            this.logger.error('Failed to get inspiration by id', {
                operation: 'InspirationsService.getInspirationById',
                inspirationId: id,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            throw error
        }
    }

    async updateInspiration(id: string, userDescription: string): Promise<RawInspiration | null> {
        try {
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
        } catch (error) {
            this.logger.error('Failed to update inspiration', {
                operation: 'InspirationsService.updateInspiration',
                inspirationId: id,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            throw error
        }
    }

    async deleteInspiration(id: string): Promise<boolean> {
        try {
            const inspiration = await this.inspirationsRepository.findById(id)

            if (!inspiration) {
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
        } catch (error) {
            this.logger.error('Failed to delete inspiration', {
                operation: 'InspirationsService.deleteInspiration',
                inspirationId: id,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            throw error
        }
    }
}

