import type { NextFunction, Request, Response } from 'express'

import type { ILogger } from '@/shared/logger/logger.interface'
import type { IWaitlistService } from '@/modules/waitlist/services/waitlist.service.interface'
import { joinWaitlistSchema } from '@/modules/waitlist/validation/waitlist.schemas'

export class WaitlistController {
    private readonly waitlistService: IWaitlistService
    private readonly logger: ILogger

    constructor(waitlistService: IWaitlistService, logger: ILogger) {
        this.waitlistService = waitlistService
        this.logger = logger
    }

    async join(req: Request, res: Response, next: NextFunction): Promise<void> {
        const payload = joinWaitlistSchema.parse(req.body)
        const result = await this.waitlistService.joinWaitlist(payload)

        this.logger.info('Waitlist join request handled', {
            operation: 'WaitlistController.join',
            email: payload.email,
            status: result.status,
        })

        res.json(result)
    }
}
