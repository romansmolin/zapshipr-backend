import { randomUUID } from 'crypto'
import { mkdir, rmdir, unlink, writeFile } from 'fs/promises'
import * as path from 'path'

import axios from 'axios'
import * as ffmpeg from 'fluent-ffmpeg'

import { PostTargetEntity } from '@/modules/post/entity/post-target'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { VideoConverter } from '@/shared/video-processor/video-converter'
import { PostStatus } from '@/modules/post/types/posts.types'

import type { IPostsService, MediaCompatibilityError, ServiceErrorEnvelope } from './posts-service.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { CreatePostsRequest, SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { IPostScheduler } from '@/shared/queue'
import type { ILogger } from '@/shared/logger/logger.interface'
import type {
    CreatePostResponse,
    PostFilters,
    PostTarget,
    PostTargetResponse,
    PostsByDateResponse,
    PostsListResponse,
} from '@/modules/post/types/posts.types'

export class PostsService implements IPostsService {
    private postRepository: IPostsRepository
    private mediaUploader: IMediaUploader
    private logger: ILogger
    private socialMediaPostSender: ISocialMediaPostSenderService
    private videoConverter: VideoConverter
    private errorHandler: SocialMediaErrorHandler
    private postScheduler?: IPostScheduler

    constructor(
        postRepository: IPostsRepository,
        mediaUploader: IMediaUploader,
        logger: ILogger,
        socialMediaPostSender: ISocialMediaPostSenderService,
        errorHandler: SocialMediaErrorHandler,
        postScheduler?: IPostScheduler
    ) {
        this.postRepository = postRepository
        this.logger = logger
        this.mediaUploader = mediaUploader
        this.socialMediaPostSender = socialMediaPostSender
        this.videoConverter = new VideoConverter(logger)
        this.errorHandler = errorHandler
        this.postScheduler = postScheduler

        this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this))
        this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this))
    }

    private async uploadCoverImage(coverImageFile: Express.Multer.File, userId: string): Promise<string> {
        const coverImageUrl = await this.mediaUploader.upload({
            key: `${userId}/covers/${Date.now()}-${coverImageFile.originalname}`,
            body: coverImageFile.buffer,
            contentType: coverImageFile.mimetype,
        })

        return coverImageUrl
    }

    private createServiceError<K extends 'MEDIA_COMPATIBILITY', D>(
        kind: K,
        code: ErrorCode,
        message: string,
        status: number,
        details: D
    ): ServiceErrorEnvelope<K, D> {
        return {
            ok: false,
            kind,
            code,
            message,
            status,
            errorId: randomUUID(),
            details,
        }
    }

    private validateMediaCompatibility(
        createPostsRequest: CreatePostsRequest,
        medias: { [fieldname: string]: Express.Multer.File[] } | undefined | Express.Multer.File[]
    ): MediaCompatibilityError | null {
        if (createPostsRequest.postType !== 'media') {
            return null
        }

        if (!medias) {
            return null
        }

        let mediaFiles: Express.Multer.File[] = []

        if (Array.isArray(medias)) {
            mediaFiles = medias
        } else if (medias && typeof medias === 'object') {
            const filesWithoutCover = { ...medias }
            delete filesWithoutCover['coverImage']
            mediaFiles = Object.values(filesWithoutCover).flat()
        }

        if (mediaFiles.length === 0) {
            return null
        }

        const hasVideo = mediaFiles.some((file) => file.mimetype.startsWith('video/'))
        const hasImage = mediaFiles.some((file) => file.mimetype.startsWith('image/'))

        if (!hasVideo && !hasImage) {
            return null
        }

        const incompatibleAccounts: Array<{ accountId: string; platform: string; reason: string }> = []

        for (const post of createPostsRequest.posts) {
            const platform = post.platform.toLowerCase()

            if (hasVideo && platform === 'bluesky') {
                incompatibleAccounts.push({
                    accountId: post.account,
                    platform: 'bluesky',
                    reason: 'Bluesky does not support video posts. Only images are supported.',
                })
            }
        }

        if (incompatibleAccounts.length > 0) {
            return this.createServiceError(
                'MEDIA_COMPATIBILITY',
                ErrorCode.CONTENT_VALIDATION_FAILED,
                'Some selected accounts do not support the media type you are trying to publish.',
                400,
                {
                    incompatibleAccounts,
                }
            )
        }

        return null
    }

    private async validateVideoDuration(
        file: Express.Multer.File,
        createPostsRequest: CreatePostsRequest
    ): Promise<void> {
        const hasInstagramTarget = createPostsRequest.posts.some((post) => post.platform === 'instagram')

        if (!hasInstagramTarget) {
            return
        }

        try {
            const tempDir = await this.createTempDir()
            const tempFilePath = path.join(tempDir, `temp-${Date.now()}.${file.originalname.split('.').pop()}`)

            await this.writeBufferToFile(file.buffer, tempFilePath)

            const videoInfo = await this.getVideoDuration(tempFilePath)

            await this.cleanupTempFiles([tempFilePath], tempDir)

            if (videoInfo.duration < 3) {
                throw new BaseAppError(
                    `Video duration is too short for Instagram Reels. Minimum duration is 3 seconds, but your video is ${videoInfo.duration.toFixed(2)} seconds.`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            this.logger.info('Video duration validation passed', {
                operation: 'validateVideoDuration',
                duration: videoInfo.duration,
                fileName: file.originalname,
                platform: 'instagram',
            })
        } catch (error) {
            if (error instanceof BaseAppError) {
                throw error
            }

            this.logger.warn('Video duration validation failed, allowing upload', {
                operation: 'validateVideoDuration',
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
                fileName: file.originalname,
            })
        }
    }

    private async getVideoDuration(videoPath: string): Promise<{ duration: number }> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err)
                    return
                }

                const duration = metadata.format.duration || 0
                resolve({ duration })
            })
        })
    }

    private async createTempDir(): Promise<string> {
        const tempDir = path.join(process.cwd(), 'temp', 'video-validation', `validation-${Date.now()}`)
        await mkdir(tempDir, { recursive: true })
        return tempDir
    }

    private async writeBufferToFile(buffer: Buffer, filePath: string): Promise<void> {
        await writeFile(filePath, buffer)
    }

    private async cleanupTempFiles(filePaths: string[], dir?: string): Promise<void> {
        for (const filePath of filePaths) {
            try {
                await unlink(filePath)
            } catch (error) {
                this.logger.warn('Failed to cleanup temporary file', {
                    filePath,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                })
            }
        }

        if (dir) {
            try {
                await rmdir(dir)
            } catch (error) {
                this.logger.warn('Failed to cleanup temporary directory', {
                    dir,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                })
            }
        }
    }

    private getFileMimeTypeFromURL(url: string, returnMimeType = false): string | null {
        const pathname = new URL(url).pathname
        const ext = pathname.split('.').pop()?.toLowerCase()

        if (!ext) return null

        if (!returnMimeType) {
            return ext
        }

        const mimeTypes: Record<string, string> = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
        }

        return mimeTypes[ext] || `application/octet-stream`
    }

    private buildSafeFilenameFromUrl(url: string, index: number): string {
        try {
            const pathname = new URL(url).pathname
            const decoded = decodeURIComponent(pathname.split('/').pop() || '')
            const base = decoded
                .replace(/[^a-zA-Z0-9._-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
            if (base) return `${Date.now()}-${index}-${base}`
        } catch (_) {
            // fallback handled below
        }
        return `${Date.now()}-${index}-media`
    }

    private buildSafeFilename(originalName: string, index: number, fallbackExt?: string): string {
        const name = decodeURIComponent(originalName || '').trim()
        const hasExt = name.includes('.')
        const safe = name
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
        const ext = hasExt ? '' : fallbackExt ? `.${fallbackExt}` : ''
        const base = safe || `media${ext}`
        return `${Date.now()}-${index}-${base}`
    }

    private async uploadAndSaveMediaFiles(
        medias: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined,
        userId: string,
        postId: string,
        createPostsRequest: CreatePostsRequest,
        copyDataUrls?: string[]
    ): Promise<void> {
        let mediaFiles: Express.Multer.File[] = []
        let orderCounter = 1

        if (copyDataUrls && copyDataUrls.length > 0) {
            const copyTasks = copyDataUrls.map(async (copyUrl, idx) => {
                const safeName = this.buildSafeFilenameFromUrl(copyUrl, idx)
                try {
                    const response = await axios.get<ArrayBuffer>(copyUrl, { responseType: 'arraybuffer' })
                    const buffer = Buffer.from(response.data)
                    const mimeType =
                        response.headers['content-type'] ||
                        this.getFileMimeTypeFromURL(copyUrl, true) ||
                        `application/octet-stream`

                    const mediaUrl = await this.mediaUploader.upload({
                        key: `${userId}/posts/${safeName}`,
                        body: buffer,
                        contentType: mimeType,
                    })

                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: mediaUrl,
                        type: mimeType,
                    })

                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)

                    this.logger.info('Attached copied media asset to post', {
                        operation: 'uploadAndSaveMediaFiles',
                        userId,
                        postId,
                        mediaId,
                        sourceIndex: idx,
                        mimeType,
                        order: orderCounter - 1,
                    })
                } catch (error) {
                    this.logger.warn('Failed to re-upload copied media, falling back to source URL', {
                        operation: 'uploadAndSaveMediaFiles',
                        userId,
                        postId,
                        copyUrl,
                        error:
                            error instanceof Error
                                ? { name: error.name, code: 'COPY_UPLOAD_FAILED', stack: error.message }
                                : { name: 'UnknownError', code: 'COPY_UPLOAD_FAILED' },
                    })

                    const mimeType = this.getFileMimeTypeFromURL(copyUrl, true) || `application/octet-stream`
                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: copyUrl,
                        type: mimeType,
                    })
                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)
                }
            })

            await Promise.all(copyTasks)
        }

        if (Array.isArray(medias)) {
            mediaFiles = medias
        } else if (medias && typeof medias === 'object') {
            delete medias['coverImage']
            mediaFiles = Object.values(medias).flat()
        }

        if (mediaFiles.length > 0) {
            for (let index = 0; index < mediaFiles.length; index++) {
                const file = mediaFiles[index]
                let processedBuffer = file.buffer
                let contentType = file.mimetype
                let originalName = this.buildSafeFilename(
                    file.originalname,
                    orderCounter,
                    file.mimetype.split('/')[1]
                )

                if (file.mimetype.includes('video')) {
                    await this.validateVideoDuration(file, createPostsRequest)
                }

                if (file.mimetype.includes('video') && this.videoConverter.needsConversion(file.mimetype, 'mp4')) {
                    this.logger.info('Converting video to MP4', {
                        operation: 'uploadAndSaveMediaFiles',
                        originalMimeType: file.mimetype,
                        originalName: file.originalname,
                    })

                    try {
                        processedBuffer = await this.videoConverter.convertVideo(file.buffer, {
                            targetFormat: 'mp4',
                            quality: 'medium',
                            maxFileSize: 50 * 1024 * 1024,
                        })
                        contentType = this.videoConverter.getMimeTypeForFormat('mp4')

                        originalName = originalName.replace(/\.(mov|MOV|webm|WEBM)$/, '.mp4')

                        this.logger.info('Video conversion completed', {
                            operation: 'uploadAndSaveMediaFiles',
                            originalSize: file.buffer.length,
                            convertedSize: processedBuffer.length,
                            newMimeType: contentType,
                            newName: originalName,
                        })
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                        this.logger.error('Video conversion failed, using original file', {
                            operation: 'uploadAndSaveMediaFiles',
                            error: { name: 'VideoConversionError', stack: errorMessage },
                            originalMimeType: file.mimetype,
                        })
                        processedBuffer = file.buffer
                        contentType = file.mimetype
                    }
                }

                const mediaUrl = await this.mediaUploader.upload({
                    key: `${userId}/posts/${originalName}`,
                    body: processedBuffer,
                    contentType: contentType,
                })

                const { mediaId } = await this.postRepository.savePostMediaAssets({
                    userId,
                    url: mediaUrl,
                    type: contentType,
                })

                await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)

                this.logger.info('Successfully uploaded media', {
                    operation: 'createPost',
                    userId,
                    postId,
                    mediaId,
                    index: orderCounter - 1,
                    totalFiles: mediaFiles.length + (copyDataUrls?.length ?? 0),
                    contentType,
                    originalName,
                })
            }
        }
    }

    private requirePostScheduler(): IPostScheduler {
        if (!this.postScheduler) {
            throw new BaseAppError('Post scheduler is not configured', ErrorCode.UNKNOWN_ERROR, 500)
        }

        return this.postScheduler
    }

    private async schedulePostTargets(
        postId: string,
        userId: string,
        scheduledTime: Date,
        targets: PostTarget[]
    ): Promise<void> {
        if (targets.length === 0) return

        const scheduler = this.requirePostScheduler()

        await Promise.all(
            targets.map((target) =>
                scheduler.schedulePost(target.platform, postId, userId, scheduledTime, target.socialAccountId)
            )
        )
    }

    private async cleanupScheduledJobs(
        postId: string,
        platforms: Iterable<SocilaMediaPlatform>,
        throwOnError: boolean
    ): Promise<void> {
        if (!this.postScheduler) {
            return
        }

        const uniquePlatforms = Array.from(new Set(platforms))
        if (uniquePlatforms.length === 0) return

        const results = await Promise.allSettled(
            uniquePlatforms.map((platform) => this.postScheduler!.cleanupJobsForDeletedPost(platform, postId))
        )

        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

        if (failures.length > 0) {
            this.logger.error('Failed to cleanup scheduled jobs', {
                operation: 'cleanupScheduledJobs',
                postId,
                platforms: uniquePlatforms,
                failureCount: failures.length,
            })

            if (throwOnError) {
                throw new BaseAppError('Failed to cleanup scheduled jobs', ErrorCode.UNKNOWN_ERROR, 500)
            }
        }
    }

    async createPost(
        createPostsRequest: CreatePostsRequest,
        medias: { [fieldname: string]: Express.Multer.File[] } | undefined | Express.Multer.File[],
        userId: string
    ): Promise<CreatePostResponse | MediaCompatibilityError> {
        try {
            const mediaCompatibilityError = this.validateMediaCompatibility(createPostsRequest, medias)
            if (mediaCompatibilityError) {
                return mediaCompatibilityError
            }

            const isDraft = createPostsRequest.postStatus === PostStatus.DRAFT
            const isScheduled = !isDraft && createPostsRequest.scheduledTime && !createPostsRequest.postNow

            if (isScheduled && createPostsRequest.scheduledTime) {
                if (createPostsRequest.scheduledTime.getTime() <= Date.now()) {
                    throw new BaseAppError('Scheduled time must be in the future', ErrorCode.BAD_REQUEST, 400)
                }
            }

            let initialStatus = createPostsRequest.postStatus
            if (isScheduled) {
                initialStatus = PostStatus.PENDING
            }

            let coverImageUrl: string | undefined

            if (medias && typeof medias === 'object' && !Array.isArray(medias)) {
                const coverImageFiles = medias['coverImage']

                if (Array.isArray(coverImageFiles) && coverImageFiles.length > 0) {
                    coverImageUrl = await this.uploadCoverImage(coverImageFiles[0], userId)
                }
            }

            const { postId } = await this.postRepository.createBasePost(
                userId,
                initialStatus,
                createPostsRequest.postType,
                createPostsRequest.scheduledTime ?? null,
                createPostsRequest.mainCaption ?? null,
                createPostsRequest.coverTimestamp ?? null,
                coverImageUrl
            )

            if (createPostsRequest.postType === 'media' && (medias || createPostsRequest.copyDataUrls)) {
                await this.uploadAndSaveMediaFiles(
                    medias,
                    userId,
                    postId,
                    createPostsRequest,
                    createPostsRequest.copyDataUrls
                )
            }

            const postTargets: PostTarget[] = createPostsRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }))

            await this.postRepository.createPostTargets(postTargets)

            if (isScheduled && createPostsRequest.scheduledTime) {
                try {
                    await this.schedulePostTargets(postId, userId, createPostsRequest.scheduledTime, postTargets)
                } catch (error) {
                    await this.cleanupScheduledJobs(
                        postId,
                        postTargets.map((target) => target.platform),
                        false
                    )

                    await this.postRepository.updateBasePost(
                        postId,
                        userId,
                        PostStatus.FAILED,
                        createPostsRequest.scheduledTime,
                        createPostsRequest.mainCaption ?? null
                    )

                    this.logger.error('Failed to schedule post targets', {
                        operation: 'createPost',
                        postId,
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    })

                    if (error instanceof BaseAppError) {
                        throw error
                    }

                    throw new BaseAppError('Failed to schedule post targets', ErrorCode.UNKNOWN_ERROR, 500)
                }
            }

            if (!isDraft && createPostsRequest.postNow) {
                this.logger.info('Starting immediate post sending', {
                    operation: 'createPost',
                    userId,
                    postId,
                    postCount: createPostsRequest.posts.length,
                    platforms: createPostsRequest.posts.map((p) => p.platform),
                })

                const targetsByPlatform = createPostsRequest.posts.reduce(
                    (acc, target) => {
                        if (!acc[target.platform]) {
                            acc[target.platform] = []
                        }
                        acc[target.platform].push(target)
                        return acc
                    },
                    {} as Record<string, any[]>
                )

                const sendingPromises = Object.entries(targetsByPlatform).map(([platform, targets]) => {
                    return Promise.all(
                        targets.map(async (target) => {
                            try {
                                await this.socialMediaPostSender.sendPost(
                                    userId,
                                    postId,
                                    platform as SocilaMediaPlatform,
                                    target.account
                                )
                                return { success: true, target }
                            } catch (error) {
                                return { success: false, target, error }
                            }
                        })
                    )
                })

                const results = await Promise.allSettled(sendingPromises)

                const allTargetResults: Array<{ target: any; success: boolean; error?: any }> = []

                results.forEach((platformResult, platformIndex) => {
                    if (platformResult.status === 'fulfilled') {
                        const targetResults = platformResult.value

                        targetResults.forEach((targetResult) => {
                            allTargetResults.push({
                                target: targetResult.target,
                                success: targetResult.success,
                                error: targetResult.error,
                            })
                        })
                    } else {
                        const platformTargets = Object.values(targetsByPlatform)[platformIndex]
                        platformTargets.forEach((target) => {
                            allTargetResults.push({
                                target,
                                success: false,
                                error: platformResult.reason,
                            })
                        })
                    }
                })

                const failures = allTargetResults.filter((item) => !item.success)
                const successes = allTargetResults.filter((item) => item.success)

                if (failures.length > 0) {
                    await Promise.all(
                        failures.map(async ({ target, error }) => {
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

                            await this.postRepository.updatePostTarget(
                                userId,
                                postId,
                                target.account,
                                PostStatus.FAILED,
                                errorMessage
                            )
                        })
                    )
                }

                if (successes.length > 0) {
                    await Promise.all(
                        successes.map(async ({ target }) => {
                            await this.postRepository.updatePostTarget(
                                userId,
                                postId,
                                target.account,
                                PostStatus.DONE
                            )
                        })
                    )
                }

                if (failures.length === createPostsRequest.posts.length) {
                    await this.postRepository.updateBasePost(
                        postId,
                        userId,
                        PostStatus.FAILED,
                        createPostsRequest.scheduledTime || new Date(),
                        createPostsRequest.mainCaption ?? null
                    )

                    this.logger.error('All immediate posts failed to send', {
                        operation: 'createPost',
                        postId,
                        userId,
                        failureCount: failures.length,
                        totalPosts: createPostsRequest.posts.length,
                        errors: failures.map((f) =>
                            f.error instanceof Error ? f.error.message : 'Unknown error'
                        ),
                    })
                } else if (successes.length === createPostsRequest.posts.length) {
                    await this.postRepository.updateBasePost(
                        postId,
                        userId,
                        PostStatus.DONE,
                        createPostsRequest.scheduledTime || new Date(),
                        createPostsRequest.mainCaption ?? null
                    )

                    this.logger.info('All immediate posts sent successfully', {
                        operation: 'createPost',
                        postId,
                        userId,
                        successCount: successes.length,
                        totalPosts: createPostsRequest.posts.length,
                    })
                } else {
                    await this.postRepository.updateBasePost(
                        postId,
                        userId,
                        PostStatus.PARTIALLY_DONE,
                        createPostsRequest.scheduledTime || new Date(),
                        createPostsRequest.mainCaption ?? null
                    )

                    this.logger.warn('Some immediate posts failed to send', {
                        operation: 'createPost',
                        postId,
                        userId,
                        successCount: successes.length,
                        failureCount: failures.length,
                        totalPosts: createPostsRequest.posts.length,
                        errors: failures.map((f) =>
                            f.error instanceof Error ? f.error.message : 'Unknown error'
                        ),
                    })
                }
            }

            return await this.postRepository.getPostDetails(postId, userId)
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to create post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async editPost(
        postId: string,
        updatePostRequest: CreatePostsRequest,
        file: Express.Multer.File | undefined,
        userId: string
    ): Promise<void> {
        try {
            const oldPost = await this.postRepository.getPostDetails(postId, userId)

            if (updatePostRequest.postType === 'media') {
                let medias: Express.Multer.File[] | undefined

                if (file) {
                    medias = [file]
                } else {
                    const existingMedia = await this.postRepository.getPostMediaAsset(postId)
                    if (existingMedia) {
                        const mockFile = {
                            mimetype: existingMedia.type,
                            buffer: Buffer.alloc(0),
                            originalname: '',
                            size: 0,
                            fieldname: '',
                            encoding: '',
                            destination: '',
                            filename: '',
                            path: '',
                            stream: null as any,
                        } as Express.Multer.File
                        medias = [mockFile]
                    }
                }

                if (medias) {
                    const mediaCompatibilityError = this.validateMediaCompatibility(updatePostRequest, medias)
                    if (mediaCompatibilityError) {
                        throw new BaseAppError(mediaCompatibilityError.message, mediaCompatibilityError.code, 400)
                    }
                }
            }

            if (oldPost.status === PostStatus.DONE) {
                throw new BaseAppError(
                    'Post cannot be changed, it has been alreary got published!',
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            const shouldValidateScheduledTime =
                updatePostRequest.postStatus !== PostStatus.DRAFT && !updatePostRequest.postNow

            if (shouldValidateScheduledTime && updatePostRequest.scheduledTime) {
                if (updatePostRequest.scheduledTime.getTime() <= Date.now()) {
                    throw new BaseAppError('Scheduled time must be in the future', ErrorCode.BAD_REQUEST, 400)
                }
            }

            await this.postRepository.updateBasePost(
                postId,
                userId,
                updatePostRequest.postStatus as PostStatus,
                updatePostRequest.scheduledTime ?? null,
                updatePostRequest.mainCaption ?? null
            )

            if (updatePostRequest.postType === 'media') {
                if (file) {
                    const existingMedia = await this.postRepository.getPostMediaAsset(postId)

                    const mediaUrl = await this.mediaUploader.upload({
                        key: `${userId}/posts/${Date.now()}-${file.originalname}`,
                        body: file.buffer,
                        contentType: file.mimetype,
                    })

                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: mediaUrl,
                        type: file.mimetype,
                    })

                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, 1)

                    if (existingMedia) {
                        await this.mediaUploader.delete(existingMedia.url)
                        if (existingMedia.mediaId) {
                            await this.postRepository.deletePostMediaAsset(existingMedia.mediaId)
                        }
                    }

                    this.logger.info('Successfully updated media', {
                        operation: 'editPost',
                        userId,
                        postId,
                        mediaId,
                    })
                }
            }

            const postTargets: PostTarget[] = updatePostRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }))

            await this.postRepository.updatePostTargets(postId, postTargets)

            const shouldSchedule =
                updatePostRequest.postStatus !== PostStatus.DRAFT &&
                !updatePostRequest.postNow &&
                !!updatePostRequest.scheduledTime

            const oldPlatforms = oldPost.targets.map((target) => target.platform)

            if (shouldSchedule && updatePostRequest.scheduledTime) {
                await this.cleanupScheduledJobs(postId, oldPlatforms, true)
                await this.schedulePostTargets(postId, userId, updatePostRequest.scheduledTime, postTargets)
            } else {
                await this.cleanupScheduledJobs(postId, oldPlatforms, false)
            }

            this.logger.info(`Successfully updated ${updatePostRequest.postType} post`, {
                operation: 'editPost',
                userId,
                postId,
                postType: updatePostRequest.postType,
                targetCount: postTargets.length,
            })
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to update post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async hasExistingMedia(postId: string): Promise<boolean> {
        try {
            const mediaAsset = await this.postRepository.getPostMediaAsset(postId)
            return !!mediaAsset
        } catch (error) {
            this.logger.error('Failed to check existing media', {
                operation: 'hasExistingMedia',
                postId,
            })
            return false
        }
    }

    async getPostsByFilters(userId: string, filters: PostFilters): Promise<PostsListResponse> {
        try {
            const response = await this.postRepository.getPosts(userId, filters)
            return response
        } catch (error) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get posts', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async deletePostsOrphanedByAccount(userId: string, accountId: string): Promise<void> {
        try {
            const orphanedPostIds = await this.postRepository.getPostsTargetedOnlyByAccount(userId, accountId)

            if (orphanedPostIds.length === 0) return

            const deletionResults = await Promise.allSettled(
                orphanedPostIds.map(async (postId) => {
                    await this.deletePost(postId, userId)
                    this.logger.info('Deleted post with no remaining targets after account removal', {
                        operation: 'deletePost',
                        userId,
                        postId,
                        removedAccountId: accountId,
                    })
                })
            )

            const failedDeletions = deletionResults.filter(
                (result): result is PromiseRejectedResult => result.status === 'rejected'
            )

            if (failedDeletions.length > 0) {
                this.logger.error('Failed to delete one or more orphaned posts for account removal', {
                    operation: 'deletePost',
                    userId,
                    removedAccountId: accountId,
                    failedCount: failedDeletions.length,
                })

                const firstError = failedDeletions[0].reason
                if (firstError instanceof BaseAppError) throw firstError
                throw new BaseAppError(
                    'Failed to delete orphaned post for account removal',
                    ErrorCode.UNKNOWN_ERROR,
                    500
                )
            }
        } catch (error) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError(
                'Failed to delete orphaned posts for account removal',
                ErrorCode.UNKNOWN_ERROR,
                500
            )
        }
    }

    async deletePost(postId: string, userId: string): Promise<void> {
        try {
            const postDetails = await this.postRepository.getPostDetails(postId, userId)
            await this.cleanupScheduledJobs(
                postId,
                postDetails.targets.map((target) => target.platform),
                false
            )

            const { mediaUrls, coverImageUrl } = await this.postRepository.deletePost(postId, userId)

            if (mediaUrls.length > 0) {
                await Promise.all(
                    mediaUrls.map(async (url) => {
                        try {
                            await this.mediaUploader.delete(url)
                        } catch (error) {
                            this.logger.error('Failed to delete media from S3', {
                                operation: 'deletePost',
                                postId,
                                userId,
                                url,
                                error:
                                    error instanceof Error
                                        ? {
                                              name: error.name,
                                              stack: error.stack,
                                          }
                                        : undefined,
                            })
                        }
                    })
                )
            }

            if (coverImageUrl) {
                try {
                    await this.mediaUploader.delete(coverImageUrl)
                } catch (error) {
                    this.logger.error('Failed to delete cover image from S3', {
                        operation: 'deletePost',
                        postId,
                        userId,
                        coverImageUrl,
                        error:
                            error instanceof Error
                                ? {
                                      name: error.name,
                                      stack: error.stack,
                                  }
                                : undefined,
                    })
                }
            }

            this.logger.info('Successfully deleted post', {
                operation: 'deletePost',
                userId,
                postId,
                mediaCount: mediaUrls.length,
                hasCoverImage: !!coverImageUrl,
            })
        } catch (error) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to delete post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsByDate(userId: string, fromDate: Date, toDate: Date): Promise<PostsByDateResponse> {
        try {
            const { posts } = await this.postRepository.getPostsByDate(userId, fromDate, toDate)

            return { posts }
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get posts by from date and to date', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsFailedCount(userId: string): Promise<number> {
        try {
            const failedCount = await this.postRepository.getPostsFailedCount(userId)

            return failedCount
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get failed posts count', ErrorCode.BAD_REQUEST, 500)
        }
    }

    async retryPostTarget(
        userId: string,
        postId: string,
        socialAccountId: string
    ): Promise<{ postTarget: PostTargetResponse; post: CreatePostResponse }> {
        try {
            const result = await this.postRepository.retryPostTarget(userId, postId, socialAccountId)

            try {
                await this.socialMediaPostSender.sendPost(
                    userId,
                    postId,
                    result.postTarget.platform,
                    result.postTarget.socialAccountId
                )

                this.logger.info('Post target retry completed successfully', {
                    operation: 'retryPostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    platform: result.postTarget.platform,
                })

                return result
            } finally {
                this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this))
                this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this))
            }
        } catch (error: unknown) {
            this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this))
            this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this))

            try {
                await this.checkAndUpdateBasePostStatus(userId, postId)
            } catch (statusError) {
                this.logger.error('Failed to update post status after retry failure', {
                    operation: 'retryPostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    error:
                        statusError instanceof Error
                            ? {
                                  name: statusError.name,
                                  code: (statusError as any).code,
                                  stack: statusError.stack,
                              }
                            : undefined,
                })
            }

            const errorResult = await this.errorHandler.handleSocialMediaError(
                error,
                'unknown',
                userId,
                postId,
                socialAccountId
            )

            throw errorResult.error
        }
    }

    async cancelPostTarget(userId: string, postId: string, socialAccountId: string): Promise<void> {
        try {
            await this.postRepository.updatePostTarget(
                userId,
                postId,
                socialAccountId,
                PostStatus.FAILED,
                'Job cancelled'
            )

            this.logger.info('Cancelled post target', {
                operation: 'cancelPostTarget',
                userId,
                postId,
                socialAccountId,
            })
        } catch (error: unknown) {
            this.logger.error('Failed to cancel post target', {
                operation: 'cancelPostTarget',
                userId,
                postId,
                socialAccountId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })
            throw error
        }
    }

    async deletePostTarget(userId: string, postId: string, socialAccountId: string): Promise<void> {
        try {
            await this.postRepository.deletePostTarget(userId, postId, socialAccountId)

            try {
                await this.checkAndUpdateBasePostStatus(userId, postId)
            } catch (statusError) {
                this.logger.warn('Failed to update post status after deleting post target', {
                    operation: 'deletePostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    error:
                        statusError instanceof Error
                            ? {
                                  name: statusError.name,
                                  stack: statusError.stack,
                              }
                            : undefined,
                })
            }

            this.logger.info('Deleted post target successfully', {
                operation: 'deletePostTarget',
                userId,
                postId,
                socialAccountId,
            })
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error

            this.logger.error('Failed to delete post target', {
                operation: 'deletePostTarget',
                userId,
                postId,
                socialAccountId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })

            throw new BaseAppError('Failed to delete post target', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async checkAndUpdateBasePostStatus(userId: string, postId: string): Promise<void> {
        try {
            const postDetails = await this.postRepository.getPostDetails(postId, userId)

            const allTargetsDone = postDetails.targets.every((target) => target.status === PostStatus.DONE)
            const someTargetsDone = postDetails.targets.some((target) => target.status === PostStatus.DONE)
            const someTargetsFailed = postDetails.targets.some((target) => target.status === PostStatus.FAILED)
            const allTargetsFailed = postDetails.targets.every((target) => target.status === PostStatus.FAILED)

            if (allTargetsDone && postDetails.status !== PostStatus.DONE) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.DONE, new Date(), undefined)

                this.logger.info('Base post status updated to DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                })
            } else if (someTargetsDone && someTargetsFailed && postDetails.status !== PostStatus.PARTIALLY_DONE) {
                await this.postRepository.updateBasePost(
                    postId,
                    userId,
                    PostStatus.PARTIALLY_DONE,
                    new Date(),
                    undefined
                )

                this.logger.info('Base post status updated to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === PostStatus.FAILED).length,
                })
            } else if (postDetails.status === PostStatus.POSTING && someTargetsDone && someTargetsFailed) {
                await this.postRepository.updateBasePost(
                    postId,
                    userId,
                    PostStatus.PARTIALLY_DONE,
                    new Date(),
                    undefined
                )

                this.logger.info('Base post status updated from POSTING to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === PostStatus.FAILED).length,
                })
            } else if (allTargetsFailed && postDetails.status !== PostStatus.FAILED) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.FAILED, new Date(), undefined)

                this.logger.info('Base post status updated to FAILED', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                })
            }
        } catch (error) {
            this.logger.error('Failed to check and update base post status', {
                operation: 'checkAndUpdateBasePostStatus',
                userId,
                postId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })
        }
    }

    async getFailedPostTargets(userId: string): Promise<PostTargetEntity[]> {
        try {
            const failedPosts = await this.postRepository.getFailedPostTargets(userId)

            return failedPosts
        } catch (err: unknown) {
            if (err instanceof BaseAppError) throw err
            throw new BaseAppError('Faile to get failed post targets', ErrorCode.BAD_REQUEST, 500)
        }
    }
}
