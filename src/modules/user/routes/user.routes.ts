import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import type { ILogger } from '@/shared/logger/logger.interface'
import { asyncHandler } from '@/shared/http/async-handler'
import { authMiddleware } from '@/middleware/auth.middleware'
import { upload } from '@/middleware/upload.middleware'

import { UserController } from '../controllers/user.controller'
import { UserService } from '../services/user.service'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'
import { PostsRepository } from '@/modules/post/repositories/posts.repository'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { MediaRepository } from '@/modules/media/repositories/media.repository'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'

export const createUserRoutes = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const userRepository = new UserRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)
    const accountRepository = new AccountRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)
    const mediaUploader = new S3Uploader(logger)

    const userService = new UserService(
        userRepository,
        workspaceRepository,
        postsRepository,
        accountRepository,
        mediaRepository,
        mediaUploader,
        db,
        logger
    )
    const userController = new UserController(userService, logger)

    router.get('/user/info', authMiddleware, asyncHandler(userController.getUserInfo.bind(userController)))
    router.put(
        '/user/settings',
        authMiddleware,
        upload.single('avatar'),
        asyncHandler(userController.updateUserSettings.bind(userController))
    )
    router.delete(
        '/user/delete',
        authMiddleware,
        asyncHandler(userController.deleteUserAccount.bind(userController))
    )

    return router
}
