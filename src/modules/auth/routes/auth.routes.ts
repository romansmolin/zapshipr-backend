import type { Router } from 'express'
import { Router as createRouter } from 'express'

import { bindController } from '@/shared/http/bind-controller'

import { AuthController } from '../controllers/auth.controller'

import type { IAuthService } from '../services/auth/auth-service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface AuthModuleDeps {
    logger: ILogger
    authService: IAuthService
}

export interface AuthModule {
    router: Router
}

export const buildAuthModule = ({ logger, authService }: AuthModuleDeps): AuthModule => {
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
