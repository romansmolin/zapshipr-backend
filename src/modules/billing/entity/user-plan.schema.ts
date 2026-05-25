import { boolean, index, text, timestamp, uuid, uniqueIndex, pgTable } from 'drizzle-orm/pg-core'

import { users } from '@/modules/user/entity/user.schema'

export const userPlans = pgTable(
    'user_plans',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        planName: text('plan_name').notNull(),
        planType: text('plan_type').notNull().default('monthly'),
        startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
        endDate: timestamp('end_date', { withTimezone: true }),
        isActive: boolean('is_active').notNull().default(true),
        stripeSubscriptionId: text('stripe_subscription_id'),
        stripePriceId: text('stripe_price_id'),
        stripeLookupKey: text('stripe_lookup_key'),
        billingStatus: text('billing_status').notNull().default('active'),
        currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        userIdx: index('user_plans_user_id_idx').on(table.userId),
        activeIdx: index('user_plans_user_active_idx').on(table.userId, table.isActive),
        stripeSubUnique: uniqueIndex('user_plans_stripe_subscription_id_key').on(table.stripeSubscriptionId),
    })
)

export type UserPlan = typeof userPlans.$inferSelect
export type NewUserPlan = typeof userPlans.$inferInsert
