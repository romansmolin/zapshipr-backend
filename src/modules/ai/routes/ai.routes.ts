import type { Router } from 'express'
import { Router as createRouter } from 'express'

import { authMiddleware } from '@/middleware/auth.middleware'
import { asyncHandler } from '@/shared/http/async-handler'
import type { ILogger } from '@/shared/logger/logger.interface'

import { AiController } from '@/modules/ai/controllers/ai.controller'
import type { IAiService } from '@/modules/ai/services/ai.service.interface'

export const createAiRouter = (logger: ILogger, aiService: IAiService): Router => {
    const router = createRouter()
    const controller = new AiController(aiService, logger)

    router.use(authMiddleware)
    router.post('/ai/content', asyncHandler(controller.generateIntroductoryCopy.bind(controller)))

    return router
}
