import type { NextFunction, Request, Response } from 'express'

import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IAiService } from '@/modules/ai/services/ai.service.interface'
import { aiRequestSchema } from '@/modules/ai/validation/ai.schemas'

export class AiController {
    private readonly aiService: IAiService
    private readonly logger: ILogger

    constructor(aiService: IAiService, logger: ILogger) {
        this.aiService = aiService
        this.logger = logger
    }

    async generateIntroductoryCopy(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = req.user?.id

        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const payload = aiRequestSchema.parse(req.body)
        const result = await this.aiService.generateIntroductoryCopy(userId, payload)

        this.logger.info('AI content request handled', {
            operation: 'AiController.generateIntroductoryCopy',
            userId,
            items: result.length,
        })

        res.json(result)
    }
}
