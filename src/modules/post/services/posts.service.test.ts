import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { ErrorCode } from '@/shared/consts/error-codes.const'
import { ErrorMessageCode } from '@/shared/errors/app-error'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { PostStatus } from '@/modules/post/types/posts.types'
import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'

import type { CreatePostsRequest } from '@/modules/post/schemas/posts.schemas'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { CreatePostResponse } from '@/modules/post/types/posts.types'
import type { IPostScheduler } from '@/shared/queue'

import { PostsService } from './posts.service'

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

const createBasePostResponse = (): CreatePostResponse => ({
    postId: 'post-1',
    type: 'media',
    status: PostStatus.DRAFT,
    createdAt: new Date(),
    targets: [],
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
        } as unknown as jest.Mocked<IMediaUploader>

        socialMediaPostSender = {
            sendPost: jest.fn(),
            sendPostToAllPlatforms: jest.fn(),
            setOnPostSuccessCallback: jest.fn(),
            setOnPostFailureCallback: jest.fn(),
        } as unknown as jest.Mocked<ISocialMediaPostSenderService>

        const errorHandler = new SocialMediaErrorHandler(logger)

        service = new PostsService(postRepository, mediaUploader, logger, socialMediaPostSender, errorHandler)

        postRepository.createBasePost.mockResolvedValue({ postId: 'post-1' })
        postRepository.savePostMediaAssets.mockResolvedValue({ mediaId: 'media-1' })
        postRepository.getPostDetails.mockResolvedValue(createBasePostResponse())
        postRepository.getPostMediaAsset.mockResolvedValue(null)
        postRepository.getPostMediaAssets.mockResolvedValue([])
        postRepository.createPostMediaAssetRelation.mockResolvedValue()
        postRepository.createPostTargets.mockResolvedValue()
        postRepository.updateBasePost.mockResolvedValue()
        postRepository.updatePostTargets.mockResolvedValue()
        postRepository.deletePostMediaAsset.mockResolvedValue()
        mediaUploader.upload.mockResolvedValue('https://cdn.example.com/media')
    })

    it('applies media transform for uploaded image in create flow', async () => {
        const transformedBuffer = Buffer.from('transformed-image')
        const transformSpy = jest
            .spyOn(service as any, 'transformImageWithFFmpeg')
            .mockResolvedValue({ buffer: transformedBuffer, contentType: 'image/jpeg' })

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
        const transformSpy = jest.spyOn(service as any, 'transformImageWithFFmpeg')

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
        const transformSpy = jest
            .spyOn(service as any, 'transformImageWithFFmpeg')
            .mockResolvedValue({ buffer: transformedBuffer, contentType: 'image/jpeg' })

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
        const serviceWithScheduler = new PostsService(
            postRepository,
            mediaUploader,
            logger,
            socialMediaPostSender,
            errorHandler,
            scheduler
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

    it('falls back to sync postNow publishing when scheduler is missing', async () => {
        await service.createPost(
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

        expect(socialMediaPostSender.sendPost).toHaveBeenCalledTimes(1)
        expect(socialMediaPostSender.sendPost).toHaveBeenCalledWith(
            'user-1',
            'post-1',
            SocilaMediaPlatform.INSTAGRAM,
            'account-1'
        )
    })
})
