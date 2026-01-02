import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { asyncHandler } from '@/shared/http/async-handler'
import type { ILogger } from '@/shared/logger/logger.interface'

import { WaitlistController } from '@/modules/waitlist/controllers/waitlist.controller'
import { WaitlistRepository } from '@/modules/waitlist/repositories/waitlist.repository'
import { JoinWaitlistUseCase } from '@/modules/waitlist/use-cases/join-waitlist.use-case'
import { WaitlistService } from '@/modules/waitlist/services/waitlist.service'
import { NodemailerEmailService } from '@/modules/email/services/email.service'

export const createWaitlistRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const waitlistRepository = new WaitlistRepository(db, logger)
    const emailService = new NodemailerEmailService(logger)
    const joinWaitlistUseCase = new JoinWaitlistUseCase(waitlistRepository, emailService, logger)
    const waitlistService = new WaitlistService(joinWaitlistUseCase)
    const waitlistController = new WaitlistController(waitlistService, logger)

    router.post('/api/waitlist/join', asyncHandler(waitlistController.join.bind(waitlistController)))

    return router
}
