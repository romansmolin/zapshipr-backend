import { Router as createRouter } from 'express'

import { schema as dbSchema } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth.middleware'
import { createWorkspaceMiddleware } from '@/middleware/workspace.middleware'
import { upload } from '@/middleware/upload.middleware'
import { SocialMediaPublisherFactory } from '@/modules/social/factories/socia-media-publisher.factory'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { SocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.service'
import { asyncHandler } from '@/shared/http/async-handler'
import { AxiosHttpClient } from '@/shared/http-client'
import { BullMqPostScheduler } from '@/shared/queue'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { VideoProcessor } from '@/shared/video-processor/video-processor'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'

import { PostsController } from '../controllers/posts.controller'
import { PostsRepository } from '../repositories/posts.repository'
import { PostsService } from '../services/posts.service'

import type { ILogger } from '@/shared/logger/logger.interface'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Router } from 'express'

const mediaFields = [...Array.from({ length: 10 }, (_, i) => ({ name: `media[${i}]` })), { name: 'coverImage' }]

export const createPostsRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const postsRepository = new PostsRepository(db, logger)
    const accountRepository = new AccountRepository(db, logger)
    const mediaUploader = new S3Uploader(logger)
    const apiClient = new AxiosHttpClient()
    const socialMediaErrorHandler = new SocialMediaErrorHandler(logger)
    const videoProcessor = new VideoProcessor(logger)
    const socialMediaPublisherFactory = new SocialMediaPublisherFactory(
        logger,
        accountRepository,
        postsRepository,
        apiClient,
        socialMediaErrorHandler,
        videoProcessor,
        mediaUploader
    )
    const socialMediaPostSender = new SocialMediaPostSenderService(
        postsRepository,
        logger,
        socialMediaErrorHandler,
        socialMediaPublisherFactory
    )
    const postScheduler = new BullMqPostScheduler()
    const postsService = new PostsService(
        postsRepository,
        mediaUploader,
        logger,
        socialMediaPostSender,
        socialMediaErrorHandler,
        postScheduler
    )
    const postsController = new PostsController(postsService, logger)
    const workspaceMiddleware = createWorkspaceMiddleware(logger, db)

    router.use(authMiddleware)

    // Workspace-scoped routes
    router.post(
        '/workspaces/:workspaceId/post',
        asyncHandler(workspaceMiddleware),
        upload.fields(mediaFields),
        asyncHandler(postsController.createPost.bind(postsController))
    )
    router.post(
        '/workspaces/:workspaceId/post/retry',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.retryPostTarget.bind(postsController))
    )
    router.post(
        '/workspaces/:workspaceId/post/target/delete',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.deletePostTarget.bind(postsController))
    )

    router.put(
        '/workspaces/:workspaceId/post/:postId',
        asyncHandler(workspaceMiddleware),
        upload.single('media'),
        asyncHandler(postsController.editPost.bind(postsController))
    )
    router.delete(
        '/workspaces/:workspaceId/post/:postId',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.deletePost.bind(postsController))
    )

    router.get(
        '/workspaces/:workspaceId/posts',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.getPostsByFilters.bind(postsController))
    )
    router.get(
        '/workspaces/:workspaceId/posts/by-date',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.getPostsByDate.bind(postsController))
    )
    router.get(
        '/workspaces/:workspaceId/posts/failed/count',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.getPostsFailedCount.bind(postsController))
    )
    router.get(
        '/workspaces/:workspaceId/posts/failed',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.getFailedPostTargets.bind(postsController))
    )
    router.get(
        '/workspaces/:workspaceId/posts/rate-limits',
        asyncHandler(workspaceMiddleware),
        asyncHandler(postsController.getRateLimits.bind(postsController))
    )

    return router
}
