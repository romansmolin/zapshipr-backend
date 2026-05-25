import { Router as createRouter } from 'express'
import type { Router } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import { asyncHandler } from '@/shared/http/async-handler'

import { BillingService } from '../services/billing.service'

import type { ILogger } from '@/shared/logger/logger.interface'

export interface BillingModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
}

export interface BillingModule {
    router: Router
}

export const buildBillingModule = ({ db, logger }: BillingModuleDeps): BillingModule => {
    const router = createRouter()

    const userRepository = new UserRepository(db, logger)
    const billingService = new BillingService(db, userRepository, logger)

    router.post(
        '/billing/stripe/webhook',
        asyncHandler(async (req, res) => {
            const signatureHeader = req.header('stripe-signature')
            const payload = req.body as { type?: string; data?: { object?: Record<string, unknown> } }

            if (!payload?.type) {
                res.status(400).json({ error: 'Missing event type' })
                return
            }

            await billingService.handleStripeWebhook(payload as any, signatureHeader ?? undefined, req.rawBody)
            res.status(200).json({ received: true })
        })
    )

    return { router }
}
