import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import type { ILogger } from '@/shared/logger/logger.interface'
import { asyncHandler } from '@/shared/http/async-handler'
import { authMiddleware } from '@/middleware/auth.middleware'

import { UserController } from '../controllers/user.controller'
import { UserService } from '../services/user.service'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'

export const createUserRoutes = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const userRepository = new UserRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)

    const userService = new UserService(userRepository, workspaceRepository, logger)
    const userController = new UserController(userService, logger)

    router.get('/user/info', authMiddleware, asyncHandler(userController.getUserInfo.bind(userController)))

    return router
}
