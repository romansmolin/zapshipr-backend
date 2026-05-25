import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { bindController } from '@/shared/http/bind-controller'

import { WaitlistController } from '@/modules/waitlist/controllers/waitlist.controller'
import { WaitlistRepository } from '@/modules/waitlist/repositories/waitlist.repository'
import { JoinWaitlistUseCase } from '@/modules/waitlist/use-cases/join-waitlist.use-case'
import { WaitlistService } from '@/modules/waitlist/services/waitlist.service'

import type { IEmailService } from '@/modules/email/services/email.service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface WaitlistModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    emailService: IEmailService
}

export interface WaitlistModule {
    router: Router
}

export const buildWaitlistModule = ({ db, logger, emailService }: WaitlistModuleDeps): WaitlistModule => {
    const router = createRouter()

    const waitlistRepository = new WaitlistRepository(db, logger)
    const joinWaitlistUseCase = new JoinWaitlistUseCase(waitlistRepository, emailService, logger)
    const waitlistService = new WaitlistService(joinWaitlistUseCase)
    const waitlistController = new WaitlistController(waitlistService, logger)
    const handler = bindController(waitlistController)

    router.post('/api/waitlist/join', handler('join'))

    return { router }
}
