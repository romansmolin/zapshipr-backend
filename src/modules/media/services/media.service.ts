import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { ListUserImagesResponse, MediaItem } from '../entity/media.dto'
import { IMediaService, ListUserImagesOptions } from './media-service.interface'

export class MediaService implements IMediaService {
    constructor(
        private readonly logger: ILogger,
        private readonly mediaUploader: IMediaUploader
    ) {}

    async listUserImages(
        userId: string,
        options: ListUserImagesOptions
    ): Promise<ListUserImagesResponse> {
        try {
            // Build the user-scoped prefix
            // Format: {userId}/[optional-subprefix]
            // This matches the existing upload pattern seen in posts.service.ts and upload-account-avatar.ts
            const userPrefix = options.prefix ? `${userId}/${options.prefix}` : `${userId}/`

            this.logger.info('Listing user images from S3', {
                operation: 'listUserImages',
                userId,
                prefix: userPrefix,
                limit: options.limit,
                signed: options.signed,
            })

            // Call S3 list operation
            const result = await this.mediaUploader.listObjects({
                prefix: userPrefix,
                maxKeys: options.limit,
                continuationToken: options.cursor,
            })

            // Filter to only include image files (common image extensions)
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
            const imageItems = result.items.filter((item) =>
                imageExtensions.some((ext) => item.key.toLowerCase().endsWith(ext))
            )

            // Map to response items
            const items: MediaItem[] = await Promise.all(
                imageItems.map(async (item) => {
                    const baseUrl = `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${item.key}`

                    const mediaItem: MediaItem = {
                        key: item.key,
                        url: baseUrl,
                        size: item.size,
                        lastModified: item.lastModified.toISOString(),
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
                count: items.length,
                hasMore: result.isTruncated,
            })

            return {
                items,
                nextCursor: result.nextContinuationToken,
                hasMore: result.isTruncated,
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
