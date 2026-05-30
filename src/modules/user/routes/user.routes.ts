import type { Router } from 'express'
import { Router as createRouter } from 'express'

import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'
import { upload } from '@/middleware/upload.middleware'

import { UserController } from '../controllers/user.controller'

import type { IUserService } from '../services/user/user.service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface UserModuleDeps {
    logger: ILogger
    userService: IUserService
}

export interface UserModule {
    router: Router
}

export const buildUserModule = ({ logger, userService }: UserModuleDeps): UserModule => {
    const router = createRouter()
    const userController = new UserController(userService, logger)
    const handler = bindController(userController)

    router.get('/user/info', authMiddleware, handler('getUserInfo'))
    router.put('/user/settings', authMiddleware, upload.single('avatar'), handler('updateUserSettings'))
    router.delete('/user/delete', authMiddleware, handler('deleteUserAccount'))

    return { router }
}
