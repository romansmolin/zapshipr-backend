import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { ListUserImagesResponse, MediaItem } from '../../entity/media.dto'
import { IMediaService, ListUserImagesOptions } from './media-service.interface'
import { IMediaRepository } from '../../repositories/media-repository.interface'

export class MediaService implements IMediaService {
    private static readonly POSTS_PREFIX = 'posts/'

    constructor(
        private readonly logger: ILogger,
        private readonly mediaRepository: IMediaRepository,
        private readonly mediaUploader: IMediaUploader
    ) {}

    private resolvePostsOnlyPrefix(prefix?: string): string {
        const rawPrefix = prefix?.trim() ?? ''

        if (!rawPrefix) {
            return MediaService.POSTS_PREFIX
        }

        const normalized = rawPrefix.replace(/^\/+/, '')

        if (normalized.startsWith(MediaService.POSTS_PREFIX)) {
            return normalized
        }

        return `${MediaService.POSTS_PREFIX}${normalized}`
    }

    private resolveS3KeyFromUrl(url: string): string | null {
        try {
            const parsedUrl = new URL(url)
            const hostname = parsedUrl.hostname.toLowerCase()
            const pathname = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, '')
            const bucket = process.env.AWS_S3_BUCKET?.trim().toLowerCase()

            if (!pathname) {
                return null
            }

            if (bucket && (hostname === `${bucket}.s3.amazonaws.com` || hostname.startsWith(`${bucket}.s3.`))) {
                return pathname
            }

            if (bucket && (hostname === 's3.amazonaws.com' || hostname.startsWith('s3.'))) {
                const bucketPrefix = `${bucket}/`
                if (pathname.startsWith(bucketPrefix)) {
                    return pathname.slice(bucketPrefix.length)
                }
            }

            return null
        } catch {
            return null
        }
    }

    private async mapToResponseItems(
        records: Array<{ url: string; contentType: string | null; lastModified: Date; key?: string }>,
        options: Pick<ListUserImagesOptions, 'signed' | 'expiresIn'>
    ): Promise<MediaItem[]> {
        return Promise.all(
            records.map(async (item) => {
                const s3Key = item.key ?? this.resolveS3KeyFromUrl(item.url)
                const mediaItem: MediaItem = {
                    key: s3Key ?? item.url,
                    url: item.url,
                    size: undefined,
                    lastModified: item.lastModified.toISOString(),
                    contentType: item.contentType ?? undefined,
                }

                if (options.signed && s3Key) {
                    mediaItem.signedUrl = await this.mediaUploader.getSignedUrl(s3Key, options.expiresIn)
                } else if (options.signed) {
                    mediaItem.signedUrl = item.url
                }

                return mediaItem
            })
        )
    }

    async listUserImages(
        userId: string,
        options: ListUserImagesOptions
    ): Promise<ListUserImagesResponse> {
        try {
            const postsOnlyPrefix = this.resolvePostsOnlyPrefix(options.prefix)
            this.logger.info('Listing user images from database', {
                operation: 'listUserImages',
                userId,
                page: options.page,
                limit: options.limit,
                prefix: options.prefix,
                resolvedPrefix: postsOnlyPrefix,
                signed: options.signed,
            })

            // Load post-linked media and filter by the effective posts prefix.
            // We keep this in-service to avoid exposing non-post folders in gallery endpoint.
            const postMedia = await this.mediaRepository.findPostMediaByUserId(userId)
            const scopedPrefix = `${userId}/${postsOnlyPrefix}`

            const dedupedMedia = new Map<string, { url: string; contentType: string | null; lastModified: Date }>()
            for (const item of postMedia) {
                if (!dedupedMedia.has(item.url)) {
                    dedupedMedia.set(item.url, item)
                }
            }

            const filteredMedia = Array.from(dedupedMedia.values()).filter((item) => {
                const s3Key = this.resolveS3KeyFromUrl(item.url)

                // Keep non-S3 URLs (e.g. copied external image URLs) only for default posts listing.
                if (!s3Key) {
                    return postsOnlyPrefix === MediaService.POSTS_PREFIX
                }

                return s3Key.startsWith(scopedPrefix)
            })

            if (filteredMedia.length === 0) {
                this.logger.warn('No post-linked media found, falling back to legacy user_media table', {
                    operation: 'listUserImages',
                    userId,
                    resolvedPrefix: postsOnlyPrefix,
                })

                const totalItems = await this.mediaRepository.countByUserId(userId, postsOnlyPrefix)
                const totalPages = Math.ceil(totalItems / options.limit)
                const offset = (options.page - 1) * options.limit
                const legacyMedia = await this.mediaRepository.findByUserId(userId, {
                    limit: options.limit,
                    offset,
                    prefix: postsOnlyPrefix,
                })

                const items = await this.mapToResponseItems(
                    legacyMedia.map((item) => ({
                        key: item.key,
                        url: item.url,
                        contentType: item.contentType ?? null,
                        lastModified: item.lastModified,
                    })),
                    options
                )

                return {
                    items,
                    page: options.page,
                    pageSize: options.limit,
                    totalItems,
                    totalPages,
                    hasNextPage: options.page < totalPages,
                    hasPreviousPage: options.page > 1,
                }
            }

            const totalItems = filteredMedia.length
            const totalPages = Math.ceil(totalItems / options.limit)
            const offset = (options.page - 1) * options.limit
            const pagedMedia = filteredMedia.slice(offset, offset + options.limit)
            const items = await this.mapToResponseItems(pagedMedia, options)

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
