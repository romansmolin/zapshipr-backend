import type { Router } from 'express'
import { Router as createRouter } from 'express'

import { authMiddleware } from '@/middleware/auth.middleware'
import { bindController } from '@/shared/http/bind-controller'

import { AiController } from '@/modules/ai/controllers/ai.controller'

import type { IAiService } from '@/modules/ai/services/ai.service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface AiModuleDeps {
    logger: ILogger
    aiService: IAiService
}

export interface AiModule {
    router: Router
}

export const buildAiModule = ({ logger, aiService }: AiModuleDeps): AiModule => {
    const router = createRouter()
    const controller = new AiController(aiService, logger)
    const handler = bindController(controller)

    router.post('/ai/content', authMiddleware, handler('generateIntroductoryCopy'))

    return { router }
}
