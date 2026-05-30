import { randomUUID } from 'crypto'

import { PostTargetEntity } from '@/modules/post/entity/post-target'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { AppError } from '@/shared/errors/app-error'
import { BaseAppError } from '@/shared/errors/base-error'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { PostStatus } from '@/modules/post/types/posts.types'
import { resolveExtension } from '@/shared/utils/mime'
import { updateFilenameExtension } from '@/shared/utils/filename'

import type {
    IPostsService,
    MediaCompatibilityError,
    PostCreateQueuedResponse,
    PostPreparationJobPayload,
} from './posts-service.interface'
import type { IPostMediaService } from '../post-media/post-media-service.interface'
import type { IPostSchedulingService } from '../post-scheduling/post-scheduling-service.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender/social-media-post-sender.interface'
import type {
    CreatePostsRequest,
    PresignUploadFileRequest,
    PresignedUploadResponseItem,
} from '@/modules/post/schemas/posts.schemas'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { ImageProcessor } from '@/shared/image-processor/image-processor'
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
    private imageProcessor: ImageProcessor
    private postMediaService: IPostMediaService
    private postSchedulingService: IPostSchedulingService
    private errorHandler: SocialMediaErrorHandler

    constructor(
        postRepository: IPostsRepository,
        mediaUploader: IMediaUploader,
        logger: ILogger,
        socialMediaPostSender: ISocialMediaPostSenderService,
        errorHandler: SocialMediaErrorHandler,
        imageProcessor: ImageProcessor,
        postMediaService: IPostMediaService,
        postSchedulingService: IPostSchedulingService
    ) {
        this.postRepository = postRepository
        this.logger = logger
        this.mediaUploader = mediaUploader
        this.socialMediaPostSender = socialMediaPostSender
        this.imageProcessor = imageProcessor
        this.postMediaService = postMediaService
        this.postSchedulingService = postSchedulingService
        this.errorHandler = errorHandler

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

    private getUploadFlowMode(): 'dual' | 'presigned' | 'multipart' {
        const mode = (process.env.POST_UPLOAD_FLOW ?? 'dual').toLowerCase()
        if (mode === 'presigned' || mode === 'multipart') {
            return mode
        }
        return 'dual'
    }

    private isAsyncPostNowEnabled(): boolean {
        return (process.env.POST_NOW_ASYNC_ENABLED ?? 'false').toLowerCase() === 'true'
    }

    async createPresignedUploadUrls(
        userId: string,
        workspaceId: string,
        files: PresignUploadFileRequest[]
    ): Promise<PresignedUploadResponseItem[]> {
        const expiresIn = 15 * 60

        return Promise.all(
            files.map(async (file, index) => {
                const extension = resolveExtension(file.mimeType, file.extension)
                const key = `${userId}/posts/staged/${workspaceId}/${Date.now()}-${index}-${randomUUID()}.${extension}`
                return this.mediaUploader.getPresignedUploadUrl({
                    key,
                    contentType: file.mimeType,
                    expiresIn,
                })
            })
        )
    }

    async processPostPreparationJob(payload: PostPreparationJobPayload): Promise<void> {
        const startedAt = Date.now()
        const postDetails = await this.postRepository.getPostDetails(payload.postId, payload.userId)

        if (postDetails.status === PostStatus.DRAFT) {
            return
        }

        try {
            await this.postMediaService.applyMediaTransformsToStoredAssets(payload)

            const postTargets: PostTarget[] = postDetails.targets.map((target) => ({
                ...target,
                postId: payload.postId,
                socialAccountId: target.socialAccountId,
            }))

            await this.postSchedulingService.schedulePostTargets(payload.postId, payload.userId, new Date(), postTargets)

            this.logger.info('post_preparation_ms', {
                operation: 'processPostPreparationJob',
                postId: payload.postId,
                userId: payload.userId,
                metric: 'post_preparation_ms',
                value: Date.now() - startedAt,
            })
        } catch (error) {
            await this.postRepository.updateBasePost(
                payload.postId,
                payload.userId,
                PostStatus.FAILED,
                postDetails.mainCaption
            )
            throw error
        }
    }

    private async rollbackFailedPostCreation(postId: string, userId: string, workspaceId: string): Promise<void> {
        try {
            await this.deletePost(postId, userId, workspaceId)
            this.logger.warn('Rolled back post created during failed createPost flow', {
                operation: 'rollbackFailedPostCreation',
                postId,
                userId,
                workspaceId,
            })
        } catch (cleanupError) {
            this.logger.error('Failed to rollback post after createPost error', {
                operation: 'rollbackFailedPostCreation',
                postId,
                userId,
                workspaceId,
                error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
            })
        }
    }

    async createPost(
        createPostsRequest: CreatePostsRequest,
        medias: { [fieldname: string]: Express.Multer.File[] } | undefined | Express.Multer.File[],
        userId: string,
        workspaceId: string
    ): Promise<CreatePostResponse | MediaCompatibilityError | PostCreateQueuedResponse> {
        let createdPostId: string | null = null

        try {
            const createStartedAt = Date.now()
            const uploadedMediaFiles = this.postMediaService.extractUploadedMediaFiles(medias)
            const copyMediaCount = createPostsRequest.copyDataUrls?.length ?? 0
            const uploadedMediaCount = createPostsRequest.uploadedMedia?.length ?? 0
            const mediaPoolCount =
                createPostsRequest.postType === 'media'
                    ? uploadedMediaFiles.length + copyMediaCount + uploadedMediaCount
                    : 0

            const normalizedCreatePostsRequest: CreatePostsRequest = {
                ...createPostsRequest,
                posts: this.postMediaService.normalizePostTargetsMediaIndices(createPostsRequest, mediaPoolCount),
            }
            const selectedMediaIndices = this.postMediaService.collectSelectedMediaIndices(
                normalizedCreatePostsRequest.posts
            )

            const mediaCompatibilityError = this.postMediaService.validateMediaCompatibility(
                normalizedCreatePostsRequest,
                medias
            )
            if (mediaCompatibilityError) {
                return mediaCompatibilityError
            }

            const scheduledUtc = this.postSchedulingService.resolveScheduledTime(
                normalizedCreatePostsRequest.scheduledAtLocal,
                normalizedCreatePostsRequest.timezone
            )
            const isDraft = normalizedCreatePostsRequest.postStatus === PostStatus.DRAFT
            const isPostNow = !isDraft && normalizedCreatePostsRequest.postNow === true
            const isScheduled = !isDraft && scheduledUtc && !isPostNow
            const scheduledAtLocal = isScheduled ? (normalizedCreatePostsRequest.scheduledAtLocal ?? null) : null
            const scheduledTimezone = isScheduled ? (normalizedCreatePostsRequest.timezone ?? null) : null

            if (isScheduled && scheduledUtc) {
                if (scheduledUtc.getTime() <= Date.now()) {
                    throw new BaseAppError('Scheduled time must be in the future', ErrorCode.BAD_REQUEST, 400)
                }
            }

            let initialStatus = normalizedCreatePostsRequest.postStatus
            if (isScheduled || isPostNow) {
                initialStatus = PostStatus.PENDING
            }

            const useAsyncPostNow = isPostNow && this.isAsyncPostNowEnabled()
            const uploadFlowMode = this.getUploadFlowMode()
            const canUseUploadedMedia =
                uploadFlowMode !== 'multipart' &&
                Array.isArray(normalizedCreatePostsRequest.uploadedMedia) &&
                normalizedCreatePostsRequest.uploadedMedia.length > 0

            let coverImageUrl: string | undefined

            if (medias && typeof medias === 'object' && !Array.isArray(medias)) {
                const coverImageFiles = medias['coverImage']

                if (Array.isArray(coverImageFiles) && coverImageFiles.length > 0) {
                    coverImageUrl = await this.uploadCoverImage(coverImageFiles[0], userId)
                }
            }

            const { postId } = await this.postRepository.createBasePost(
                userId,
                workspaceId,
                initialStatus,
                normalizedCreatePostsRequest.postType,
                scheduledAtLocal,
                scheduledTimezone,
                normalizedCreatePostsRequest.mainCaption ?? null,
                normalizedCreatePostsRequest.coverTimestamp ?? null,
                coverImageUrl
            )
            createdPostId = postId

            if (normalizedCreatePostsRequest.postType === 'media') {
                if (useAsyncPostNow) {
                    const asyncMediaRequest = canUseUploadedMedia
                        ? normalizedCreatePostsRequest
                        : { ...normalizedCreatePostsRequest, uploadedMedia: undefined }
                    await this.postMediaService.attachMediaReferencesForAsyncPostNow(
                        canUseUploadedMedia ? undefined : medias,
                        asyncMediaRequest,
                        userId,
                        postId
                    )
                } else if (medias || normalizedCreatePostsRequest.copyDataUrls) {
                    await this.postMediaService.uploadAndSaveMediaFiles(
                        medias,
                        userId,
                        postId,
                        normalizedCreatePostsRequest,
                        normalizedCreatePostsRequest.copyDataUrls,
                        selectedMediaIndices
                    )
                } else if (canUseUploadedMedia) {
                    let orderCounter = 1
                    orderCounter = await this.postMediaService.saveCopyMediaReferences(
                        normalizedCreatePostsRequest.copyDataUrls,
                        userId,
                        postId,
                        orderCounter
                    )
                    await this.postMediaService.saveUploadedMediaReferences(
                        normalizedCreatePostsRequest.uploadedMedia ?? [],
                        userId,
                        postId,
                        orderCounter
                    )

                    if (this.postMediaService.getMediaTransforms(normalizedCreatePostsRequest).length > 0) {
                        await this.postMediaService.applyMediaTransformsToStoredAssets({
                            postId,
                            userId,
                            workspaceId,
                            mediaTransforms: this.postMediaService.getMediaTransforms(normalizedCreatePostsRequest),
                            selectedMediaIndices: Array.from(selectedMediaIndices),
                        })
                    }
                }
            }

            const postTargets: PostTarget[] = normalizedCreatePostsRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }))

            await this.postRepository.createPostTargets(postTargets)

            if (isScheduled && scheduledUtc) {
                try {
                    await this.postSchedulingService.schedulePostTargets(postId, userId, scheduledUtc, postTargets)
                } catch (error) {
                    await this.postSchedulingService.cleanupScheduledJobs(
                        postId,
                        postTargets.map((target) => target.platform),
                        false
                    )

                    await this.postRepository.updateBasePost(
                        postId,
                        userId,
                        PostStatus.FAILED,
                        normalizedCreatePostsRequest.mainCaption ?? null
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

            if (isPostNow) {
                if (useAsyncPostNow) {
                    await this.postSchedulingService.enqueuePostPreparation({
                        postId,
                        userId,
                        workspaceId,
                        mediaTransforms: this.postMediaService.getMediaTransforms(normalizedCreatePostsRequest),
                        selectedMediaIndices: Array.from(selectedMediaIndices),
                    })

                    this.logger.info('post_create_ack_ms', {
                        operation: 'createPost',
                        postId,
                        userId,
                        metric: 'post_create_ack_ms',
                        value: Date.now() - createStartedAt,
                    })

                    return {
                        postId,
                        status: PostStatus.PENDING,
                        queued: true,
                    }
                }

                await this.postSchedulingService.enqueueImmediatePostTargets(
                    postId,
                    userId,
                    postTargets,
                    normalizedCreatePostsRequest.mainCaption ?? null
                )
            }

            return await this.postRepository.getPostDetails(postId, userId)
        } catch (error: unknown) {
            if (createdPostId) {
                await this.rollbackFailedPostCreation(createdPostId, userId, workspaceId)
            }

            if (error instanceof AppError) throw error
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to create post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async editPost(
        postId: string,
        updatePostRequest: CreatePostsRequest,
        file: Express.Multer.File | undefined,
        userId: string,
        workspaceId: string
    ): Promise<void> {
        try {
            const oldPost = await this.postRepository.getPostDetails(postId, userId)
            let existingMediaAssets: Awaited<ReturnType<IPostsRepository['getPostMediaAssets']>> = []
            if (updatePostRequest.postType === 'media') {
                existingMediaAssets = await this.postRepository.getPostMediaAssets(postId)
            }
            const mediaPoolCount =
                updatePostRequest.postType === 'media'
                    ? file
                        ? Math.max(existingMediaAssets.length, 1)
                        : existingMediaAssets.length
                    : 0
            const normalizedUpdatePostRequest: CreatePostsRequest = {
                ...updatePostRequest,
                posts: this.postMediaService.normalizePostTargetsMediaIndices(updatePostRequest, mediaPoolCount),
            }
            const selectedMediaIndices = this.postMediaService.collectSelectedMediaIndices(
                normalizedUpdatePostRequest.posts
            )
            const editMediaTransform = this.postMediaService.getSingleEditTransform(
                normalizedUpdatePostRequest,
                selectedMediaIndices,
                file
            )

            if (normalizedUpdatePostRequest.postType === 'media') {
                let medias: Express.Multer.File[] | undefined

                if (file) {
                    medias = [file]
                } else {
                    const existingMedia = existingMediaAssets[0]
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
                    const mediaCompatibilityError = this.postMediaService.validateMediaCompatibility(
                        normalizedUpdatePostRequest,
                        medias
                    )
                    if (mediaCompatibilityError) {
                        throw new BaseAppError(mediaCompatibilityError.message, mediaCompatibilityError.code, 400)
                    }
                }
            }

            if (oldPost.status === PostStatus.DONE) {
                throw new BaseAppError(
                    'Post cannot be changed, it has already got published!',
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            const scheduledUtc = this.postSchedulingService.resolveScheduledTime(
                normalizedUpdatePostRequest.scheduledAtLocal,
                normalizedUpdatePostRequest.timezone
            )
            const scheduledAtLocal = scheduledUtc ? (normalizedUpdatePostRequest.scheduledAtLocal ?? null) : null
            const scheduledTimezone = scheduledUtc ? (normalizedUpdatePostRequest.timezone ?? null) : null
            const shouldValidateScheduledTime =
                normalizedUpdatePostRequest.postStatus !== PostStatus.DRAFT && !normalizedUpdatePostRequest.postNow

            if (shouldValidateScheduledTime && scheduledUtc) {
                if (scheduledUtc.getTime() <= Date.now()) {
                    throw new BaseAppError(
                        'Scheduled time must be in the future',
                        ErrorCode.PAST_TIME_IS_NOT_ALLOWED,
                        400
                    )
                }
            }

            await this.postRepository.updateBasePost(
                postId,
                userId,
                normalizedUpdatePostRequest.postStatus as PostStatus,
                normalizedUpdatePostRequest.mainCaption ?? null,
                scheduledAtLocal,
                scheduledTimezone
            )

            if (normalizedUpdatePostRequest.postType === 'media') {
                if (file) {
                    const existingMedia = existingMediaAssets[0]
                    let processedBuffer = file.buffer
                    let contentType = file.mimetype
                    let fileName = file.originalname

                    if (editMediaTransform) {
                        const transformedImage = await this.imageProcessor.transformImage(
                            processedBuffer,
                            contentType,
                            editMediaTransform
                        )
                        processedBuffer = transformedImage.buffer
                        contentType = transformedImage.contentType
                        fileName = updateFilenameExtension(fileName, contentType)
                    }

                    const mediaUrl = await this.mediaUploader.upload({
                        key: `${userId}/posts/${Date.now()}-${fileName}`,
                        body: processedBuffer,
                        contentType,
                    })

                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: mediaUrl,
                        type: contentType,
                        sizeBytes: processedBuffer.length,
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

            const postTargets: PostTarget[] = normalizedUpdatePostRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }))

            await this.postRepository.updatePostTargets(postId, postTargets)

            const shouldSchedule =
                normalizedUpdatePostRequest.postStatus !== PostStatus.DRAFT &&
                !normalizedUpdatePostRequest.postNow &&
                !!scheduledUtc

            const oldPlatforms = oldPost.targets.map((target) => target.platform)

            if (shouldSchedule && scheduledUtc) {
                await this.postSchedulingService.cleanupScheduledJobs(postId, oldPlatforms, true)
                await this.postSchedulingService.schedulePostTargets(postId, userId, scheduledUtc, postTargets)
            } else {
                await this.postSchedulingService.cleanupScheduledJobs(postId, oldPlatforms, false)
            }

            this.logger.info(`Successfully updated ${updatePostRequest.postType} post`, {
                operation: 'editPost',
                userId,
                postId,
                postType: normalizedUpdatePostRequest.postType,
                targetCount: postTargets.length,
            })
        } catch (error: unknown) {
            if (error instanceof AppError) throw error
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

    async getPostsByFilters(
        userId: string,
        workspaceId: string,
        filters: PostFilters
    ): Promise<PostsListResponse> {
        try {
            const response = await this.postRepository.getPosts(userId, workspaceId, filters)
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

    async deletePost(postId: string, userId: string, workspaceId?: string): Promise<void> {
        try {
            const postDetails = await this.postRepository.getPostDetails(postId, userId)
            await this.postSchedulingService.cleanupScheduledJobs(
                postId,
                postDetails.targets.map((target) => target.platform),
                false
            )

            const { mediaUrls, coverImageUrl } = await this.postRepository.deletePost(postId, userId, workspaceId)

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

    async getPostsByDate(
        userId: string,
        workspaceId: string,
        fromDate: Date,
        toDate: Date
    ): Promise<PostsByDateResponse> {
        try {
            const { posts } = await this.postRepository.getPostsByDate(userId, workspaceId, fromDate, toDate)

            return { posts }
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get posts by from date and to date', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsFailedCount(userId: string, workspaceId: string): Promise<number> {
        try {
            const failedCount = await this.postRepository.getPostsFailedCount(userId, workspaceId)

            return failedCount
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get failed posts count', ErrorCode.BAD_REQUEST, 500)
        }
    }

    async retryPostTarget(
        userId: string,
        workspaceId: string,
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

    async deletePostTarget(
        userId: string,
        workspaceId: string,
        postId: string,
        socialAccountId: string
    ): Promise<void> {
        try {
            await this.postRepository.deletePostTarget(userId, postId, socialAccountId)
            const postDetails = await this.postRepository.getPostDetails(postId, userId)

            if (postDetails.targets.length === 0) {
                await this.deletePost(postId, userId, workspaceId)

                this.logger.info('Deleted base post after removing last post target', {
                    operation: 'deletePostTarget',
                    userId,
                    workspaceId,
                    postId,
                    socialAccountId,
                })
                return
            }

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
            if (postDetails.targets.length === 0) {
                this.logger.warn('Skipping base post status update because post has no targets', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                })
                return
            }

            const allTargetsDone = postDetails.targets.every((target) => target.status === PostStatus.DONE)
            const someTargetsDone = postDetails.targets.some((target) => target.status === PostStatus.DONE)
            const someTargetsFailed = postDetails.targets.some((target) => target.status === PostStatus.FAILED)
            const allTargetsFailed = postDetails.targets.every((target) => target.status === PostStatus.FAILED)

            if (allTargetsDone && postDetails.status !== PostStatus.DONE) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.DONE, undefined)

                this.logger.info('Base post status updated to DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                })
            } else if (someTargetsDone && someTargetsFailed && postDetails.status !== PostStatus.PARTIALLY_DONE) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.PARTIALLY_DONE, undefined)

                this.logger.info('Base post status updated to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === PostStatus.FAILED).length,
                })
            } else if (postDetails.status === PostStatus.POSTING && someTargetsDone && someTargetsFailed) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.PARTIALLY_DONE, undefined)

                this.logger.info('Base post status updated from POSTING to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === PostStatus.FAILED).length,
                })
            } else if (allTargetsFailed && postDetails.status !== PostStatus.FAILED) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.FAILED, undefined)

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

    async getFailedPostTargets(userId: string, workspaceId: string): Promise<PostTargetEntity[]> {
        try {
            const failedPosts = await this.postRepository.getFailedPostTargets(userId, workspaceId)

            return failedPosts
        } catch (err: unknown) {
            if (err instanceof BaseAppError) throw err
            throw new BaseAppError('Failed to get failed post targets', ErrorCode.BAD_REQUEST, 500)
        }
    }
}
