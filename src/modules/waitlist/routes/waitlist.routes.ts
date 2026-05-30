import type { Router } from 'express'
import { Router as createRouter } from 'express'

import { bindController } from '@/shared/http/bind-controller'

import { WaitlistController } from '@/modules/waitlist/controllers/waitlist.controller'

import type { IWaitlistService } from '@/modules/waitlist/services/waitlist/waitlist.service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface WaitlistModuleDeps {
    logger: ILogger
    waitlistService: IWaitlistService
}

export interface WaitlistModule {
    router: Router
}

export const buildWaitlistModule = ({ logger, waitlistService }: WaitlistModuleDeps): WaitlistModule => {
    const router = createRouter()
    const waitlistController = new WaitlistController(waitlistService, logger)
    const handler = bindController(waitlistController)

    router.post('/api/waitlist/join', handler('join'))

    return { router }
}
