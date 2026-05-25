import { Router as createRouter } from 'express'
import type { Router } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import { bindController } from '@/shared/http/bind-controller'

import type { IEmailService } from '@/modules/email/services/email.service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

import { AuthController } from '../controllers/auth.controller'
import { AuthService } from '../services/auth.service'

export interface AuthModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    emailService: IEmailService
}

export interface AuthModule {
    router: Router
}

export const buildAuthModule = ({ db, logger, emailService }: AuthModuleDeps): AuthModule => {
    const userRepository = new UserRepository(db, logger)
    const authService = new AuthService(userRepository, emailService, logger)
    const authController = new AuthController(authService, logger)

    const router = createRouter()

    const handler = bindController(authController)

    router.post('/auth/sign-up', handler('signUp'))
    router.post('/auth/sign-in', handler('signIn'))

    router.put('/auth/change-password', handler('changePassword'))
    router.post('/auth/password/reset', handler('changePassword'))
    router.post('/auth/password/forgot', handler('forgetPassword'))
    router.post('/auth/forget-password', handler('forgetPassword'))

    router.get('/auth/me', handler('authMe'))

    router.post('/auth/refresh', handler('authRefresh'))
    router.post('/auth/logout', handler('logout'))

    router.get('/auth/callback/google', handler('googleCallback'))

    return { router }
}
