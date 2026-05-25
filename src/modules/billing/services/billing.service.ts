import { createHmac, timingSafeEqual, randomUUID } from 'crypto'

import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { DBSchema } from '@/db/schema'
import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { UserPlans } from '@/shared/consts/plans'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import type { ILogger } from '@/shared/logger/logger.interface'

interface StripeWebhookEvent {
    type: string
    data?: {
        object?: Record<string, unknown>
    }
}

interface StripeSubscriptionObject {
    id?: string
    customer?: string | { id?: string }
    status?: string
    current_period_start?: number
    current_period_end?: number
    trial_end?: number | null
    metadata?: Record<string, string>
    items?: {
        data?: Array<{
            price?: {
                id?: string
                lookup_key?: string | null
            }
        }>
    }
}

interface StripeCheckoutSessionObject {
    mode?: string
    payment_status?: string
    customer?: string
    subscription?: string
    client_reference_id?: string | null
    metadata?: Record<string, string>
}

export class BillingService {
    private pendingSubscriptions = new Map<string, StripeSubscriptionObject>()

    constructor(
        private readonly db: NodePgDatabase<DBSchema>,
        private readonly userRepository: IUserRepository,
        private readonly logger: ILogger
    ) {}

    async handleStripeWebhook(event: StripeWebhookEvent, signature?: string, rawBody?: Buffer): Promise<void> {
        this.verifyWebhookSignature(signature, rawBody)

        this.logger.info('Stripe webhook received', {
            operation: 'BillingService.handleStripeWebhook',
            eventType: event.type,
        })

        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await this.handleSubscriptionUpsert((event.data?.object ?? {}) as StripeSubscriptionObject)
                return
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted((event.data?.object ?? {}) as StripeSubscriptionObject)
                return
            case 'checkout.session.completed':
                await this.handleCheckoutCompleted((event.data?.object ?? {}) as StripeCheckoutSessionObject)
                return
            default:
                this.logger.info('Stripe webhook ignored', {
                    operation: 'BillingService.handleStripeWebhook',
                    eventType: event.type,
                })
        }
    }

    private verifyWebhookSignature(signature?: string, rawBody?: Buffer): void {
        const secret = (process.env.STRIPE_WEBHOOK_SECRET_DEV ?? process.env.STRIPE_WEBHOOK_SECRET)?.trim()

        if (!secret) return

        if (!signature || !rawBody)
            throw new BaseAppError('Stripe webhook signature is required', ErrorCode.BAD_REQUEST, 400)

        const timestampMatch = signature.match(/(?:^|,)t=(\d+)/)
        const v1Match = signature.match(/(?:^|,)v1=([0-9a-fA-F]+)/)

        if (!timestampMatch?.[1] || !v1Match?.[1])
            throw new BaseAppError('Invalid Stripe signature header format', ErrorCode.BAD_REQUEST, 400)

        const signedPayload = `${timestampMatch[1]}.${rawBody.toString('utf8')}`
        const expected = createHmac('sha256', secret).update(signedPayload).digest('hex')
        const expectedBuffer = Buffer.from(expected, 'utf8')
        const receivedBuffer = Buffer.from(v1Match[1], 'utf8')

        if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
            throw new BaseAppError('Invalid Stripe webhook signature', ErrorCode.BAD_REQUEST, 400)
        }
    }

    private resolveCustomerId(value: string | { id?: string } | undefined): string | null {
        if (!value) return null
        if (typeof value === 'string') return value
        if (typeof value.id === 'string') return value.id
        return null
    }

    private resolveStripePlan(priceId?: string): UserPlans {
        const proPriceIds = [
            process.env.STRIPE_PRICE_PRO_MONTHLY_DEV?.trim(),
            process.env.STRIPE_PRICE_PRO_YEARLY_DEV?.trim(),
            process.env.STRIPE_PRICE_PRO_MONTHLY?.trim(),
            process.env.STRIPE_PRICE_PRO_YEARLY?.trim(),
        ].filter(Boolean)

        if (proPriceIds.includes(priceId)) {
            return UserPlans.PRO
        }

        const starterPriceIds = [
            process.env.STRIPE_PRICE_STARTER_MONTHLY_DEV?.trim(),
            process.env.STRIPE_PRICE_STARTER_YEARLY_DEV?.trim(),
            process.env.STRIPE_PRICE_STARTER_MONTHLY?.trim(),
            process.env.STRIPE_PRICE_STARTER_YEARLY?.trim(),
        ].filter(Boolean)

        if (starterPriceIds.includes(priceId)) {
            return UserPlans.STARTER
        }

        // Default to STARTER for unknown prices
        return UserPlans.STARTER
    }

    private resolveStripePlanType(priceId?: string): 'monthly' | 'yearly' {
        const yearlyPriceIds = [
            process.env.STRIPE_PRICE_PRO_YEARLY_DEV?.trim(),
            process.env.STRIPE_PRICE_PRO_YEARLY?.trim(),
            process.env.STRIPE_PRICE_STARTER_YEARLY_DEV?.trim(),
            process.env.STRIPE_PRICE_STARTER_YEARLY?.trim(),
        ].filter(Boolean)

        return yearlyPriceIds.includes(priceId) ? 'yearly' : 'monthly'
    }

    private async handleSubscriptionUpsert(subscription: StripeSubscriptionObject): Promise<void> {
        const customerId = this.resolveCustomerId(subscription.customer)

        this.logger.info('Subscription upsert started', {
            operation: 'BillingService.handleSubscriptionUpsert',
            customerId,
            subscriptionId: subscription.id,
            status: subscription.status,
            metadata: subscription.metadata,
        })

        if (!customerId) return

        let user = await this.userRepository.findByStripeCustomerId(customerId)

        this.logger.info('User lookup by stripe customer id', {
            operation: 'BillingService.handleSubscriptionUpsert',
            customerId,
            userFound: !!user,
            userId: user?.id ?? undefined,
        })

        if (!user) {
            const userIdFromMetadata = subscription.metadata?.userId
            if (userIdFromMetadata) {
                user = await this.userRepository.findById(userIdFromMetadata)
                this.logger.info('User lookup by metadata userId', {
                    operation: 'BillingService.handleSubscriptionUpsert',
                    userIdFromMetadata,
                    userFound: !!user,
                })
                if (user) {
                    await this.db.execute(sql`
                        UPDATE users
                        SET stripe_customer_id = ${customerId},
                            updated_at = now()
                        WHERE id = ${user.id}
                    `)
                    this.logger.info('Saved stripe_customer_id on user from metadata', {
                        operation: 'BillingService.handleSubscriptionUpsert',
                        userId: user.id,
                        customerId,
                    })
                }
            }
        }

        if (!user) {
            this.logger.info('No user mapped yet, buffering subscription for checkout to process', {
                operation: 'BillingService.handleSubscriptionUpsert',
                customerId,
                subscriptionId: subscription.id,
            })
            this.pendingSubscriptions.set(customerId, subscription)
            return
        }

        const status = (subscription.status ?? 'active').toLowerCase()
        const inactiveStatuses = new Set(['canceled', 'unpaid', 'incomplete_expired'])
        if (inactiveStatuses.has(status)) {
            this.logger.info('Subscription inactive, deactivating plan', {
                operation: 'BillingService.handleSubscriptionUpsert',
                userId: user.id,
                status,
            })
            await this.deactivatePlan(user.id)
            return
        }

        const price = subscription.items?.data?.[0]?.price
        const plan = this.resolveStripePlan(price?.id)
        const planType = this.resolveStripePlanType(price?.id)

        const trialEnd = typeof subscription.trial_end === 'number'
            ? new Date(subscription.trial_end * 1000)
            : null

        this.logger.info('Resolving plan from price', {
            operation: 'BillingService.handleSubscriptionUpsert',
            userId: user.id,
            priceId: price?.id,
            resolvedPlan: plan,
            planType,
            status,
            trialEnd: trialEnd?.toISOString() ?? null,
        })

        await this.activatePlan(user.id, plan, {
            planType,
            billingStatus: status || 'active',
            stripeSubscriptionId: typeof subscription.id === 'string' ? subscription.id : null,
            stripePriceId: price?.id ?? null,
            stripeLookupKey: price?.lookup_key ?? null,
            endDate: trialEnd,
            startDate:
                typeof subscription.current_period_start === 'number'
                    ? new Date(subscription.current_period_start * 1000)
                    : new Date(),
            currentPeriodEnd:
                typeof subscription.current_period_end === 'number'
                    ? new Date(subscription.current_period_end * 1000)
                    : null,
        })
    }

    private async handleSubscriptionDeleted(subscription: StripeSubscriptionObject): Promise<void> {
        const customerId = this.resolveCustomerId(subscription.customer)

        this.logger.info('Subscription deleted', {
            operation: 'BillingService.handleSubscriptionDeleted',
            customerId,
            subscriptionId: subscription.id,
        })

        if (!customerId) return

        const user = await this.userRepository.findByStripeCustomerId(customerId)
        if (!user) {
            this.logger.warn('No user found for deleted subscription', {
                operation: 'BillingService.handleSubscriptionDeleted',
                customerId,
            })
            return
        }

        this.logger.info('Deactivating plan for deleted subscription', {
            operation: 'BillingService.handleSubscriptionDeleted',
            userId: user.id,
            customerId,
        })

        await this.deactivatePlan(user.id)
    }

    private async handleCheckoutCompleted(session: StripeCheckoutSessionObject): Promise<void> {
        const customerId = typeof session.customer === 'string' ? session.customer : null
        const userIdFromRef = session.client_reference_id ?? session.metadata?.userId ?? null
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

        this.logger.info('Checkout completed', {
            operation: 'BillingService.handleCheckoutCompleted',
            customerId,
            userIdFromRef,
            subscriptionId,
            mode: session.mode,
            paymentStatus: session.payment_status,
            clientReferenceId: session.client_reference_id,
            metadata: session.metadata,
        })

        if (customerId && userIdFromRef) {
            await this.db.execute(sql`
                UPDATE users
                SET stripe_customer_id = ${customerId},
                    updated_at = now()
                WHERE id = ${userIdFromRef}
            `)
            this.logger.info('Saved stripe_customer_id on user', {
                operation: 'BillingService.handleCheckoutCompleted',
                userId: userIdFromRef,
                customerId,
            })
        }

        let userId: string | null = null

        if (userIdFromRef) {
            userId = userIdFromRef
        } else if (customerId) {
            const user = await this.userRepository.findByStripeCustomerId(customerId)
            userId = user?.id ?? null
        }

        if (!userId) {
            this.logger.warn('Could not resolve userId from checkout session', {
                operation: 'BillingService.handleCheckoutCompleted',
                customerId,
                clientReferenceId: session.client_reference_id,
                metadata: session.metadata,
            })
            return
        }

        // Check if a subscription event arrived before checkout and was buffered
        if (customerId && this.pendingSubscriptions.has(customerId)) {
            const pendingSub = this.pendingSubscriptions.get(customerId)!
            this.pendingSubscriptions.delete(customerId)

            this.logger.info('Found buffered subscription, processing now that customer is mapped', {
                operation: 'BillingService.handleCheckoutCompleted',
                userId,
                customerId,
                subscriptionId: pendingSub.id,
            })

            await this.handleSubscriptionUpsert(pendingSub)
            return
        }

        this.logger.info('Checkout completed, customer mapped. Plan will be activated by subscription event.', {
            operation: 'BillingService.handleCheckoutCompleted',
            userId,
            subscriptionId,
        })
    }

    // TODO: Bad pattern to use repository specific methods right in service, we lose DI advantages here
    private async activatePlan(
        userId: string,
        planName: UserPlans,
        params?: {
            planType?: 'monthly' | 'yearly'
            billingStatus?: string | null
            stripeSubscriptionId?: string | null
            stripePriceId?: string | null
            stripeLookupKey?: string | null
            startDate?: Date | null
            endDate?: Date | null
            currentPeriodEnd?: Date | null
        }
    ): Promise<void> {
        await this.db.transaction(async (tx) => {
            await tx.execute(sql`
                UPDATE user_plans
                SET is_active = false,
                    updated_at = now()
                WHERE user_id = ${userId}
                  AND coalesce(is_active, true) = true
            `)

            await tx.execute(sql`
                INSERT INTO user_plans (
                    id,
                    user_id,
                    plan_name,
                    plan_type,
                    start_date,
                    end_date,
                    current_period_end,
                    is_active,
                    stripe_subscription_id,
                    stripe_price_id,
                    stripe_lookup_key,
                    billing_status,
                    created_at,
                    updated_at
                ) VALUES (
                    ${randomUUID()},
                    ${userId},
                    ${planName},
                    ${params?.planType ?? 'monthly'},
                    ${params?.startDate ?? new Date()},
                    ${params?.endDate ?? null},
                    ${params?.currentPeriodEnd ?? null},
                    true,
                    ${params?.stripeSubscriptionId ?? null},
                    ${params?.stripePriceId ?? null},
                    ${params?.stripeLookupKey ?? null},
                    ${params?.billingStatus ?? 'active'},
                    now(),
                    now()
                )
            `)
        })

        this.logger.info('User plan activated from billing event', {
            operation: 'BillingService.activatePlan',
            userId,
            planName,
            billingStatus: params?.billingStatus ?? 'active',
        })
    }

    private async deactivatePlan(userId: string): Promise<void> {
        await this.db.execute(sql`
            UPDATE user_plans
            SET is_active = false,
                updated_at = now()
            WHERE user_id = ${userId}
              AND coalesce(is_active, true) = true
        `)

        this.logger.info('User plan deactivated', {
            operation: 'BillingService.deactivatePlan',
            userId,
        })
    }
}
