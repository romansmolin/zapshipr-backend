import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { ListUserImagesResponse, MediaItem } from '../entity/media.dto'
import { IMediaService, ListUserImagesOptions } from './media-service.interface'
import { IMediaRepository } from '../repositories/media-repository.interface'

export class MediaService implements IMediaService {
    constructor(
        private readonly logger: ILogger,
        private readonly mediaRepository: IMediaRepository,
        private readonly mediaUploader: IMediaUploader
    ) {}

    async listUserImages(
        userId: string,
        options: ListUserImagesOptions
    ): Promise<ListUserImagesResponse> {
        try {
            this.logger.info('Listing user images from database', {
                operation: 'listUserImages',
                userId,
                page: options.page,
                limit: options.limit,
                prefix: options.prefix,
                signed: options.signed,
            })

            // Calculate offset for pagination
            const offset = (options.page - 1) * options.limit

            // Get total count for pagination metadata
            const totalItems = await this.mediaRepository.countByUserId(userId, options.prefix)

            // Calculate total pages
            const totalPages = Math.ceil(totalItems / options.limit)

            // Get paginated items from database
            const dbItems = await this.mediaRepository.findByUserId(userId, {
                limit: options.limit,
                offset,
                prefix: options.prefix,
            })

            // Map to response items
            const items: MediaItem[] = await Promise.all(
                dbItems.map(async (item) => {
                    const mediaItem: MediaItem = {
                        key: item.key,
                        url: item.url,
                        size: item.size,
                        lastModified: item.lastModified.toISOString(),
                        contentType: item.contentType ?? undefined,
                    }

                    // Optionally generate signed URL
                    if (options.signed) {
                        mediaItem.signedUrl = await this.mediaUploader.getSignedUrl(
                            item.key,
                            options.expiresIn
                        )
                    }

                    return mediaItem
                })
            )

            this.logger.info('Successfully listed user images', {
                operation: 'listUserImages',
                userId,
                page: options.page,
                totalItems,
                totalPages,
                itemsReturned: items.length,
            })

            return {
                items,
                page: options.page,
                pageSize: options.limit,
                totalItems,
                totalPages,
                hasNextPage: options.page < totalPages,
                hasPreviousPage: options.page > 1,
            }
        } catch (error) {
            this.logger.error('Failed to list user images', {
                operation: 'listUserImages',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            throw new BaseAppError(
                'Failed to retrieve user images from storage',
                ErrorCode.UNKNOWN_ERROR,
                500
            )
        }
    }
}
