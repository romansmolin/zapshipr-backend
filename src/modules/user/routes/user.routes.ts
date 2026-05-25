import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'
import { upload } from '@/middleware/upload.middleware'

import { UserController } from '../controllers/user.controller'
import { UserService } from '../services/user.service'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'
import { PostsRepository } from '@/modules/post/repositories/posts.repository'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { MediaRepository } from '@/modules/media/repositories/media.repository'

import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader'

export interface UserModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    mediaUploader: IMediaUploader
}

export interface UserModule {
    router: Router
}

export const buildUserModule = ({ db, logger, mediaUploader }: UserModuleDeps): UserModule => {
    const router = createRouter()

    const userRepository = new UserRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)
    const accountRepository = new AccountRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)

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
    const handler = bindController(userController)

    router.get('/user/info', authMiddleware, handler('getUserInfo'))
    router.put('/user/settings', authMiddleware, upload.single('avatar'), handler('updateUserSettings'))
    router.delete('/user/delete', authMiddleware, handler('deleteUserAccount'))

    return { router }
}
