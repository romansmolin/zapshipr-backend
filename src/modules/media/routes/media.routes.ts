import { Router as createRouter } from 'express'
import type { Router } from 'express'

import { authMiddleware } from '@/middleware/auth.middleware'
import { bindController } from '@/shared/http/bind-controller'

import { MediaController } from '../controllers/media.controller'

import type { IMediaService } from '../services/media/media-service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface MediaModuleDeps {
    logger: ILogger
    mediaService: IMediaService
}

export interface MediaModule {
    router: Router
}

export const buildMediaModule = ({ logger, mediaService }: MediaModuleDeps): MediaModule => {
    const router = createRouter()
    const mediaController = new MediaController(logger, mediaService)
    const handler = bindController(mediaController)

    router.get('/media/images', authMiddleware, handler('listUserImages'))

    return { router }
}
