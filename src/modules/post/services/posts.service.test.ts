import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { ErrorCode } from '@/shared/consts/error-codes.const'
import { ErrorMessageCode } from '@/shared/errors/app-error'
import { ImageProcessor } from '@/shared/image-processor/image-processor'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { PostStatus } from '@/modules/post/types/posts.types'
import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'

import type { CreatePostsRequest } from '@/modules/post/schemas/posts.schemas'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { CreatePostResponse } from '@/modules/post/types/posts.types'
import type { IPostScheduler, IPostPreparationScheduler } from '@/shared/queue'
import type { VideoConverter } from '@/shared/video-processor/video-converter'
import type { IVideoProcessor } from '@/shared/video-processor/video-processor.interface'

import { PostsService } from './posts.service'
import { PostMediaService } from './post-media.service'
import { PostSchedulingService } from './post-scheduling.service'
import type { VideoConverter as VideoConverterType } from '@/shared/video-processor/video-converter'
import type { IVideoProcessor as IVideoProcessorType } from '@/shared/video-processor/video-processor.interface'

const createNoopScheduler = (): jest.Mocked<IPostScheduler> =>
    ({
        schedulePost: jest.fn(),
        cleanupJobsForDeletedPost: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<IPostScheduler>)

const createNoopPreparationScheduler = (): jest.Mocked<IPostPreparationScheduler> =>
    ({
        schedulePostPreparation: jest.fn(),
    } as unknown as jest.Mocked<IPostPreparationScheduler>)

const createNoopVideoConverter = (): jest.Mocked<VideoConverter> =>
    ({
        needsConversion: jest.fn(() => false),
        convertVideo: jest.fn(),
        getMimeTypeForFormat: jest.fn(),
    } as unknown as jest.Mocked<VideoConverter>)

const createNoopVideoProcessor = (): jest.Mocked<IVideoProcessor> =>
    ({
        processVideoWithCover: jest.fn(),
        processVideoForPlatform: jest.fn(),
        getDurationFromBuffer: jest.fn(async () => 10),
    } as unknown as jest.Mocked<IVideoProcessor>)

const createNoopImageProcessor = (): jest.Mocked<ImageProcessor> =>
    ({
        processImageForPlatform: jest.fn(),
        getPlatformRequirements: jest.fn(),
        validateImageForPlatform: jest.fn(),
        transformImage: jest.fn(),
    } as unknown as jest.Mocked<ImageProcessor>)

const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
        fieldname: 'media[0]',
        originalname: 'image.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        destination: '',
        filename: '',
        path: '',
        stream: null as unknown as NodeJS.ReadableStream,
        buffer: Buffer.from('source-image'),
        ...overrides,
    }) as Express.Multer.File

const createBaseRequest = (overrides: Partial<CreatePostsRequest> = {}): CreatePostsRequest => ({
    postType: 'media',
    postStatus: PostStatus.DRAFT,
    posts: [
        {
            account: 'account-1',
            platform: SocilaMediaPlatform.INSTAGRAM,
        },
    ],
    ...overrides,
})

const createBasePostResponse = (overrides: Partial<CreatePostResponse> = {}): CreatePostResponse => ({
    postId: 'post-1',
    type: 'media',
    status: PostStatus.DRAFT,
    createdAt: new Date(),
    targets: [],
    ...overrides,
})

const createMockMediaAsset = (index: number) => ({
    mediaId: `media-${index}`,
    url: `https://cdn.example.com/media-${index}.jpg`,
    type: 'image/jpeg',
    order: index + 1,
})

describe('PostsService mediaTransforms', () => {
    let service: PostsService
    let logger: jest.Mocked<ILogger>
    let postRepository: jest.Mocked<IPostsRepository>
    let mediaUploader: jest.Mocked<IMediaUploader>
    let socialMediaPostSender: jest.Mocked<ISocialMediaPostSenderService>
    let imageProcessor: jest.Mocked<ImageProcessor>

    beforeEach(() => {
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as jest.Mocked<ILogger>

        postRepository = {
            createBasePost: jest.fn(),
            updateBasePost: jest.fn(),
            savePostMediaAssets: jest.fn(),
            updateMediaAsset: jest.fn(),
            createPostMediaAssetRelation: jest.fn(),
            getPostMediaAsset: jest.fn(),
            getPostMediaAssets: jest.fn(),
            getPostCoverImageUrl: jest.fn(),
            deletePostMediaAsset: jest.fn(),
            createPostTargets: jest.fn(),
            updatePostTargets: jest.fn(),
            updatePostTarget: jest.fn(),
            getPostDetails: jest.fn(),
            getPosts: jest.fn(),
            hasExistingMedia: jest.fn(),
            deletePost: jest.fn(),
            getPostsByDate: jest.fn(),
            getPostsFailedCount: jest.fn(),
            getFailedPostTargets: jest.fn(),
            retryPostTarget: jest.fn(),
            deletePostTarget: jest.fn(),
            getPostsTargetedOnlyByAccount: jest.fn(),
            deleteAllWorkspacePosts: jest.fn(),
        } as unknown as jest.Mocked<IPostsRepository>

        mediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
            listObjects: jest.fn(),
            getSignedUrl: jest.fn(),
            getPresignedUploadUrl: jest.fn(),
        } as unknown as jest.Mocked<IMediaUploader>

        socialMediaPostSender = {
            sendPost: jest.fn(),
            sendPostToAllPlatforms: jest.fn(),
            setOnPostSuccessCallback: jest.fn(),
            setOnPostFailureCallback: jest.fn(),
        } as unknown as jest.Mocked<ISocialMediaPostSenderService>

        const errorHandler = new SocialMediaErrorHandler(logger)
        imageProcessor = createNoopImageProcessor()
        const videoConverter = createNoopVideoConverter()
        const videoProcessor = createNoopVideoProcessor()
        const postMediaService = new PostMediaService(
            postRepository,
            mediaUploader,
            imageProcessor,
            videoConverter as unknown as VideoConverterType,
            videoProcessor as unknown as IVideoProcessorType,
            logger
        )
        const postSchedulingService = new PostSchedulingService(
            postRepository,
            createNoopScheduler(),
            createNoopPreparationScheduler(),
            logger
        )

        service = new PostsService(
            postRepository,
            mediaUploader,
            logger,
            socialMediaPostSender,
            errorHandler,
            imageProcessor,
            postMediaService,
            postSchedulingService
        )

        postRepository.createBasePost.mockResolvedValue({ postId: 'post-1' })
        postRepository.savePostMediaAssets.mockResolvedValue({ mediaId: 'media-1' })
        postRepository.updateMediaAsset.mockResolvedValue()
        postRepository.getPostDetails.mockResolvedValue(createBasePostResponse())
        postRepository.getPostMediaAsset.mockResolvedValue(null)
        postRepository.getPostMediaAssets.mockResolvedValue([])
        postRepository.createPostMediaAssetRelation.mockResolvedValue()
        postRepository.createPostTargets.mockResolvedValue()
        postRepository.updateBasePost.mockResolvedValue()
        postRepository.updatePostTargets.mockResolvedValue()
        postRepository.deletePostMediaAsset.mockResolvedValue()
        postRepository.deletePost.mockResolvedValue({ mediaUrls: [] })
        mediaUploader.upload.mockResolvedValue('https://cdn.example.com/media')
    })

    it('computes crop rectangle using actual image dimensions instead of frontend preview dimensions', () => {
        const realImageProcessor = new ImageProcessor(logger)
        const cropRect = (realImageProcessor as any).computeCropRect(
            {
                ratio: '1:1',
                crop: { x: 0.5, y: 0.1, scale: 2 },
                source: { width: 120, height: 240 },
            },
            240,
            480
        )

        expect(cropRect).toEqual({
            width: 120,
            height: 120,
            left: 30,
            top: 162,
        })
    })

    it('maps center-offset coordinates to crop rectangle edges', () => {
        const realImageProcessor = new ImageProcessor(logger)
        const leftEdge = (realImageProcessor as any).computeCropRect(
            {
                ratio: '1:1',
                crop: { x: 1, y: 1, scale: 1 },
                source: { width: 100, height: 100 },
            },
            200,
            100
        )

        const rightEdge = (realImageProcessor as any).computeCropRect(
            {
                ratio: '1:1',
                crop: { x: -1, y: -1, scale: 1 },
                source: { width: 100, height: 100 },
            },
            200,
            100
        )

        expect(leftEdge.left).toBe(0)
        expect(rightEdge.left).toBe(100)
    })

    it('applies media transform for uploaded image in create flow', async () => {
        const transformedBuffer = Buffer.from('transformed-image')
        imageProcessor.transformImage.mockResolvedValue({
            buffer: transformedBuffer,
            contentType: 'image/jpeg',
        })
        const transformSpy = imageProcessor.transformImage

        await service.createPost(
            createBaseRequest({
                mediaTransforms: [
                    {
                        mediaIndex: 0,
                        platform: SocilaMediaPlatform.INSTAGRAM,
                        ratio: '4:5',
                        crop: { x: 0, y: 0.2, scale: 1 },
                        source: { width: 1024, height: 1536 },
                        version: 1,
                    },
                ],
            }),
            { 'media[0]': [createMockFile()] },
            'user-1',
            'workspace-1'
        )

        expect(transformSpy).toHaveBeenCalledTimes(1)
        expect(mediaUploader.upload).toHaveBeenCalledWith(
            expect.objectContaining({
                body: transformedBuffer,
                contentType: 'image/jpeg',
            })
        )
        expect(postRepository.savePostMediaAssets).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'image/jpeg',
            })
        )
    })

    it('returns BAD_REQUEST when create transform mediaIndex is out of range', async () => {
        await expect(
            service.createPost(
                createBaseRequest({
                    mediaTransforms: [
                        {
                            mediaIndex: 1,
                            platform: SocilaMediaPlatform.INSTAGRAM,
                            ratio: '4:5',
                            crop: { x: 0, y: 0, scale: 1 },
                            source: { width: 1024, height: 1536 },
                            version: 1,
                        },
                    ],
                }),
                { 'media[0]': [createMockFile()] },
                'user-1',
                'workspace-1'
            )
        ).rejects.toMatchObject({
            code: ErrorCode.BAD_REQUEST,
            httpCode: 400,
        })

        expect(mediaUploader.upload).not.toHaveBeenCalled()
    })

    it('defaults missing mediaIndices to all uploaded media indexes in create flow', async () => {
        await service.createPost(
            createBaseRequest({
                posts: [
                    {
                        account: 'account-1',
                        platform: SocilaMediaPlatform.INSTAGRAM,
                    },
                    {
                        account: 'account-2',
                        platform: SocilaMediaPlatform.FACEBOOK,
                    },
                ],
            }),
            {
                'media[0]': [createMockFile({ fieldname: 'media[0]', originalname: '0.jpg' })],
                'media[1]': [createMockFile({ fieldname: 'media[1]', originalname: '1.jpg' })],
            },
            'user-1',
            'workspace-1'
        )

        expect(postRepository.createPostTargets).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    socialAccountId: 'account-1',
                    mediaIndices: [0, 1],
                }),
                expect.objectContaining({
                    socialAccountId: 'account-2',
                    mediaIndices: [0, 1],
                }),
            ])
        )
    })

    it('returns validation error with precise field path for out-of-range mediaIndices', async () => {
        await expect(
            service.createPost(
                createBaseRequest({
                    posts: [
                        {
                            account: 'account-1',
                            platform: SocilaMediaPlatform.INSTAGRAM,
                            mediaIndices: [0, 2],
                        },
                    ],
                }),
                {
                    'media[0]': [createMockFile()],
                },
                'user-1',
                'workspace-1'
            )
        ).rejects.toMatchObject({
            errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
            httpCode: 400,
            fields: expect.arrayContaining([
                expect.objectContaining({
                    field: 'posts.0.mediaIndices.1',
                }),
            ]),
        })
    })

    it('skips create media transform when transformed index is not selected by any target', async () => {
        const transformSpy = imageProcessor.transformImage

        await service.createPost(
            createBaseRequest({
                posts: [
                    {
                        account: 'account-1',
                        platform: SocilaMediaPlatform.INSTAGRAM,
                        mediaIndices: [0],
                    },
                ],
                mediaTransforms: [
                    {
                        mediaIndex: 1,
                        platform: SocilaMediaPlatform.INSTAGRAM,
                        ratio: '4:5',
                        crop: { x: 0, y: 0, scale: 1 },
                        source: { width: 1024, height: 1536 },
                        version: 1,
                    },
                ],
            }),
            {
                'media[0]': [createMockFile({ fieldname: 'media[0]', originalname: '0.jpg' })],
                'media[1]': [createMockFile({ fieldname: 'media[1]', originalname: '1.jpg' })],
            },
            'user-1',
            'workspace-1'
        )

        expect(transformSpy).not.toHaveBeenCalled()
    })

    it('returns BAD_REQUEST when create transform targets non-image file', async () => {
        await expect(
            service.createPost(
                createBaseRequest({
                    mediaTransforms: [
                        {
                            mediaIndex: 0,
                            platform: SocilaMediaPlatform.INSTAGRAM,
                            ratio: '4:5',
                            crop: { x: 0, y: 0, scale: 1 },
                            source: { width: 1024, height: 1536 },
                            version: 1,
                        },
                    ],
                }),
                {
                    'media[0]': [
                        createMockFile({
                            originalname: 'video.mp4',
                            mimetype: 'video/mp4',
                            buffer: Buffer.from('video-data'),
                        }),
                    ],
                },
                'user-1',
                'workspace-1'
            )
        ).rejects.toMatchObject({
            code: ErrorCode.BAD_REQUEST,
            httpCode: 400,
        })

        expect(mediaUploader.upload).not.toHaveBeenCalled()
    })

    it('applies media transform for mediaIndex 0 in edit flow', async () => {
        postRepository.getPostMediaAssets.mockResolvedValue([createMockMediaAsset(0)])
        const transformedBuffer = Buffer.from('transformed-edit-image')
        imageProcessor.transformImage.mockResolvedValue({
            buffer: transformedBuffer,
            contentType: 'image/jpeg',
        })
        const transformSpy = imageProcessor.transformImage

        await service.editPost(
            'post-1',
            createBaseRequest({
                mediaTransforms: [
                    {
                        mediaIndex: 0,
                        platform: SocilaMediaPlatform.INSTAGRAM,
                        ratio: '4:5',
                        crop: { x: 0, y: 0.4, scale: 1 },
                        source: { width: 1024, height: 1536 },
                        version: 1,
                    },
                ],
            }),
            createMockFile(),
            'user-1',
            'workspace-1'
        )

        expect(transformSpy).toHaveBeenCalledTimes(1)
        expect(mediaUploader.upload).toHaveBeenCalledWith(
            expect.objectContaining({
                body: transformedBuffer,
                contentType: 'image/jpeg',
            })
        )
    })

    it('returns BAD_REQUEST when edit has mediaTransforms without file', async () => {
        postRepository.getPostMediaAssets.mockResolvedValue([createMockMediaAsset(0)])
        await expect(
            service.editPost(
                'post-1',
                createBaseRequest({
                    mediaTransforms: [
                        {
                            mediaIndex: 0,
                            platform: SocilaMediaPlatform.INSTAGRAM,
                            ratio: '4:5',
                            crop: { x: 0, y: 0, scale: 1 },
                            source: { width: 1024, height: 1536 },
                            version: 1,
                        },
                    ],
                }),
                undefined,
                'user-1',
                'workspace-1'
            )
        ).rejects.toMatchObject({
            code: ErrorCode.BAD_REQUEST,
            httpCode: 400,
        })
    })

    it('returns BAD_REQUEST when edit mediaIndex is not 0', async () => {
        postRepository.getPostMediaAssets.mockResolvedValue([createMockMediaAsset(0)])
        await expect(
            service.editPost(
                'post-1',
                createBaseRequest({
                    mediaTransforms: [
                        {
                            mediaIndex: 1,
                            platform: SocilaMediaPlatform.INSTAGRAM,
                            ratio: '4:5',
                            crop: { x: 0, y: 0, scale: 1 },
                            source: { width: 1024, height: 1536 },
                            version: 1,
                        },
                    ],
                }),
                createMockFile(),
                'user-1',
                'workspace-1'
            )
        ).rejects.toMatchObject({
            code: ErrorCode.BAD_REQUEST,
            httpCode: 400,
        })
    })

    it('defaults missing mediaIndices to all existing media indexes in edit flow', async () => {
        postRepository.getPostMediaAssets.mockResolvedValue([createMockMediaAsset(0), createMockMediaAsset(1)])

        await service.editPost(
            'post-1',
            createBaseRequest({
                posts: [
                    {
                        account: 'account-1',
                        platform: SocilaMediaPlatform.INSTAGRAM,
                    },
                ],
            }),
            undefined,
            'user-1',
            'workspace-1'
        )

        expect(postRepository.updatePostTargets).toHaveBeenCalledWith(
            'post-1',
            expect.arrayContaining([
                expect.objectContaining({
                    socialAccountId: 'account-1',
                    mediaIndices: [0, 1],
                }),
            ])
        )
    })

    it('returns validation error for edit mediaIndices that are out of range', async () => {
        postRepository.getPostMediaAssets.mockResolvedValue([createMockMediaAsset(0)])

        await expect(
            service.editPost(
                'post-1',
                createBaseRequest({
                    posts: [
                        {
                            account: 'account-1',
                            platform: SocilaMediaPlatform.INSTAGRAM,
                            mediaIndices: [1],
                        },
                    ],
                }),
                undefined,
                'user-1',
                'workspace-1'
            )
        ).rejects.toMatchObject({
            errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
            httpCode: 400,
            fields: expect.arrayContaining([
                expect.objectContaining({
                    field: 'posts.0.mediaIndices.0',
                }),
            ]),
        })
    })

    it('deletes post media and cover image from S3 when deleting a post', async () => {
        postRepository.getPostDetails.mockResolvedValueOnce(
            createBasePostResponse({
                status: PostStatus.PENDING,
                targets: [
                    {
                        platform: SocilaMediaPlatform.INSTAGRAM,
                        socialAccountId: 'account-1',
                        status: PostStatus.PENDING,
                    },
                ],
            })
        )
        postRepository.deletePost.mockResolvedValueOnce({
            mediaUrls: [
                'https://easy-post.s3.amazonaws.com/user-1/posts/a.jpg',
                'https://easy-post.s3.us-east-1.amazonaws.com/user-1/posts/b.jpg',
            ],
            coverImageUrl: 'https://easy-post.s3.amazonaws.com/user-1/posts/cover.jpg',
        })

        await service.deletePost('post-1', 'user-1', 'workspace-1')

        expect(mediaUploader.delete).toHaveBeenCalledTimes(3)
        expect(mediaUploader.delete).toHaveBeenCalledWith('https://easy-post.s3.amazonaws.com/user-1/posts/a.jpg')
        expect(mediaUploader.delete).toHaveBeenCalledWith(
            'https://easy-post.s3.us-east-1.amazonaws.com/user-1/posts/b.jpg'
        )
        expect(mediaUploader.delete).toHaveBeenCalledWith('https://easy-post.s3.amazonaws.com/user-1/posts/cover.jpg')
    })

    it('enqueues postNow publishing when scheduler is configured', async () => {
        const scheduler: jest.Mocked<IPostScheduler> = {
            schedulePost: jest.fn(async () => undefined),
            cancelScheduledPost: jest.fn(async () => undefined),
            reschedulePost: jest.fn(async () => undefined),
            getQueueStatus: jest.fn(async () => ({
                waiting: 0,
                delayed: 0,
                active: 0,
                completed: 0,
                failed: 0,
            })),
            getAllQueuesStatus: jest.fn(async () => ({} as any)),
            cleanupJobsForDeletedPost: jest.fn(async () => undefined),
        }

        const errorHandler = new SocialMediaErrorHandler(logger)
        const localImageProcessor = createNoopImageProcessor()
        const localPostMediaService = new PostMediaService(
            postRepository,
            mediaUploader,
            localImageProcessor,
            createNoopVideoConverter() as unknown as VideoConverterType,
            createNoopVideoProcessor() as unknown as IVideoProcessorType,
            logger
        )
        const localPostSchedulingService = new PostSchedulingService(
            postRepository,
            scheduler,
            createNoopPreparationScheduler(),
            logger
        )
        const serviceWithScheduler = new PostsService(
            postRepository,
            mediaUploader,
            logger,
            socialMediaPostSender,
            errorHandler,
            localImageProcessor,
            localPostMediaService,
            localPostSchedulingService
        )

        await serviceWithScheduler.createPost(
            createBaseRequest({
                postType: 'text',
                postStatus: PostStatus.PENDING,
                postNow: true,
                posts: [
                    {
                        account: 'account-1',
                        platform: SocilaMediaPlatform.INSTAGRAM,
                        text: 'hello',
                    },
                ],
            }),
            undefined,
            'user-1',
            'workspace-1'
        )

        expect(scheduler.schedulePost).toHaveBeenCalledTimes(1)
        expect(scheduler.schedulePost).toHaveBeenCalledWith(
            SocilaMediaPlatform.INSTAGRAM,
            'post-1',
            'user-1',
            expect.any(Date),
            'account-1'
        )
        expect(socialMediaPostSender.sendPost).not.toHaveBeenCalled()
    })

    it('rolls back created base post when create flow fails after insert', async () => {
        postRepository.createPostTargets.mockRejectedValueOnce(new Error('targets insert failed'))

        await expect(
            service.createPost(
                createBaseRequest({
                    postType: 'text',
                    postStatus: PostStatus.PENDING,
                    posts: [
                        {
                            account: 'account-1',
                            platform: SocilaMediaPlatform.INSTAGRAM,
                            text: 'hello',
                        },
                    ],
                }),
                undefined,
                'user-1',
                'workspace-1'
            )
        ).rejects.toMatchObject({
            code: ErrorCode.UNKNOWN_ERROR,
            httpCode: 500,
        })

        expect(postRepository.createBasePost).toHaveBeenCalledTimes(1)
        expect(postRepository.deletePost).toHaveBeenCalledWith('post-1', 'user-1', 'workspace-1')
    })
})

describe('PostsService failed target cancellation', () => {
    let service: PostsService
    let logger: jest.Mocked<ILogger>
    let postRepository: jest.Mocked<IPostsRepository>
    let mediaUploader: jest.Mocked<IMediaUploader>
    let socialMediaPostSender: jest.Mocked<ISocialMediaPostSenderService>

    beforeEach(() => {
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as jest.Mocked<ILogger>

        postRepository = {
            createBasePost: jest.fn(),
            updateBasePost: jest.fn(),
            savePostMediaAssets: jest.fn(),
            updateMediaAsset: jest.fn(),
            createPostMediaAssetRelation: jest.fn(),
            getPostMediaAsset: jest.fn(),
            getPostMediaAssets: jest.fn(),
            getPostCoverImageUrl: jest.fn(),
            deletePostMediaAsset: jest.fn(),
            createPostTargets: jest.fn(),
            updatePostTargets: jest.fn(),
            updatePostTarget: jest.fn(),
            getPostDetails: jest.fn(),
            getPosts: jest.fn(),
            hasExistingMedia: jest.fn(),
            deletePost: jest.fn(),
            getPostsByDate: jest.fn(),
            getPostsFailedCount: jest.fn(),
            getFailedPostTargets: jest.fn(),
            retryPostTarget: jest.fn(),
            deletePostTarget: jest.fn(),
            getPostsTargetedOnlyByAccount: jest.fn(),
            deleteAllWorkspacePosts: jest.fn(),
        } as unknown as jest.Mocked<IPostsRepository>

        mediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
            listObjects: jest.fn(),
            getSignedUrl: jest.fn(),
            getPresignedUploadUrl: jest.fn(),
        } as unknown as jest.Mocked<IMediaUploader>

        socialMediaPostSender = {
            sendPost: jest.fn(),
            sendPostToAllPlatforms: jest.fn(),
            setOnPostSuccessCallback: jest.fn(),
            setOnPostFailureCallback: jest.fn(),
        } as unknown as jest.Mocked<ISocialMediaPostSenderService>

        const errorHandler = new SocialMediaErrorHandler(logger)
        const localImageProcessor = createNoopImageProcessor()
        const localPostMediaService = new PostMediaService(
            postRepository,
            mediaUploader,
            localImageProcessor,
            createNoopVideoConverter() as unknown as VideoConverterType,
            createNoopVideoProcessor() as unknown as IVideoProcessorType,
            logger
        )
        const localPostSchedulingService = new PostSchedulingService(
            postRepository,
            createNoopScheduler(),
            createNoopPreparationScheduler(),
            logger
        )
        service = new PostsService(
            postRepository,
            mediaUploader,
            logger,
            socialMediaPostSender,
            errorHandler,
            localImageProcessor,
            localPostMediaService,
            localPostSchedulingService
        )

        postRepository.deletePost.mockResolvedValue({ mediaUrls: [] })
        postRepository.deletePostTarget.mockResolvedValue()
    })

    it('deletes the base post when removing the last failed target', async () => {
        postRepository.getPostDetails
            .mockResolvedValueOnce(createBasePostResponse({ status: PostStatus.FAILED, targets: [] }))
            .mockResolvedValueOnce(createBasePostResponse({ status: PostStatus.FAILED, targets: [] }))

        await service.deletePostTarget('user-1', 'workspace-1', 'post-1', 'account-1')

        expect(postRepository.deletePostTarget).toHaveBeenCalledWith('user-1', 'post-1', 'account-1')
        expect(postRepository.deletePost).toHaveBeenCalledWith('post-1', 'user-1', 'workspace-1')
        expect(postRepository.updateBasePost).not.toHaveBeenCalled()
    })

    it('does not mark post as DONE when post has no targets', async () => {
        postRepository.getPostDetails.mockResolvedValueOnce(
            createBasePostResponse({ status: PostStatus.POSTING, targets: [] })
        )

        await service.checkAndUpdateBasePostStatus('user-1', 'post-1')

        expect(postRepository.updateBasePost).not.toHaveBeenCalled()
    })
})
