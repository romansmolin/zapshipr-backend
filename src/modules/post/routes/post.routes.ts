import { Router as createRouter } from 'express'

import { schema as dbSchema } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth.middleware'
import { createWorkspaceMiddleware } from '@/middleware/workspace.middleware'
import { upload } from '@/middleware/upload.middleware'
import { asyncHandler } from '@/shared/http/async-handler'
import { bindController } from '@/shared/http/bind-controller'

import { PostsController } from '../controllers/posts.controller'

import type { IPostsService } from '../services/posts-service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Router } from 'express'

const mediaFields = [...Array.from({ length: 10 }, (_, i) => ({ name: `media[${i}]` })), { name: 'coverImage' }]

export interface PostsModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    postsService: IPostsService
}

export interface PostsModule {
    router: Router
}

export const buildPostsModule = ({ db, logger, postsService }: PostsModuleDeps): PostsModule => {
    const router = createRouter()

    const postsController = new PostsController(postsService, logger)
    const workspaceMiddleware = createWorkspaceMiddleware(logger, db)
    const handler = bindController(postsController)

    router.use('/workspaces', authMiddleware)

    router.post(
        '/workspaces/:workspaceId/post/uploads/presign',
        asyncHandler(workspaceMiddleware),
        handler('createPresignedUploads')
    )
    router.post(
        '/workspaces/:workspaceId/post',
        asyncHandler(workspaceMiddleware),
        upload.fields(mediaFields),
        handler('createPost')
    )
    router.post(
        '/workspaces/:workspaceId/post/retry',
        asyncHandler(workspaceMiddleware),
        handler('retryPostTarget')
    )
    router.post(
        '/workspaces/:workspaceId/post/target/delete',
        asyncHandler(workspaceMiddleware),
        handler('deletePostTarget')
    )

    router.put(
        '/workspaces/:workspaceId/post/:postId',
        asyncHandler(workspaceMiddleware),
        upload.single('media'),
        handler('editPost')
    )
    router.delete(
        '/workspaces/:workspaceId/post/:postId',
        asyncHandler(workspaceMiddleware),
        handler('deletePost')
    )

    router.get('/workspaces/:workspaceId/posts', asyncHandler(workspaceMiddleware), handler('getPostsByFilters'))
    router.get(
        '/workspaces/:workspaceId/posts/by-date',
        asyncHandler(workspaceMiddleware),
        handler('getPostsByDate')
    )
    router.get(
        '/workspaces/:workspaceId/posts/failed/count',
        asyncHandler(workspaceMiddleware),
        handler('getPostsFailedCount')
    )
    router.get(
        '/workspaces/:workspaceId/posts/failed',
        asyncHandler(workspaceMiddleware),
        handler('getFailedPostTargets')
    )
    router.get(
        '/workspaces/:workspaceId/posts/rate-limits',
        asyncHandler(workspaceMiddleware),
        handler('getRateLimits')
    )

    return { router }
}
