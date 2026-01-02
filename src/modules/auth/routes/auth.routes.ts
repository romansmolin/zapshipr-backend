import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import type { ILogger } from '@/shared/logger/logger.interface'
import { asyncHandler } from '@/shared/http/async-handler'

import { AuthController } from '../controllers/auth.controller'
import { AuthService } from '../services/auth.service'

export const createAuthRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const userRepository = new UserRepository(db, logger)
    const authService = new AuthService(userRepository, logger)
    const authController = new AuthController(authService, logger)

    router.post('/auth/sign-up', asyncHandler(authController.signUp.bind(authController)))
    router.post('/auth/sign-in', asyncHandler(authController.signIn.bind(authController)))

    router.put('/auth/change-password', asyncHandler(authController.changePassword.bind(authController)))
    router.post('/auth/forget-password', asyncHandler(authController.forgetPassword.bind(authController)))

    router.get('/auth/me', asyncHandler(authController.authMe.bind(authController)))

    router.post('/auth/refresh', asyncHandler(authController.authRefresh.bind(authController)))
    router.post('/auth/logout', asyncHandler(authController.logout.bind(authController)))

    router.get('/auth/callback/google', asyncHandler(authController.googleCallback.bind(authController)))

    return router
}
