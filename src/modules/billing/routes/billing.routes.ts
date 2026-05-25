import { Router as createRouter } from 'express'
import type { Router } from 'express'

import { asyncHandler } from '@/shared/http/async-handler'

import type { BillingService } from '../services/billing.service'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface BillingModuleDeps {
    logger: ILogger
    billingService: BillingService
}

export interface BillingModule {
    router: Router
}

export const buildBillingModule = ({ billingService }: BillingModuleDeps): BillingModule => {
    const router = createRouter()

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
