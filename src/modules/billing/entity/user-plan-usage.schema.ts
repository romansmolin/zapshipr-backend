import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { users } from '@/modules/user/entity/user.schema'
import { userPlans } from '@/modules/billing/entity/user-plan.schema'

export const userPlanUsage = pgTable(
    'user_plan_usage',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        planId: uuid('plan_id')
            .notNull()
            .references(() => userPlans.id, { onDelete: 'cascade' }),
        usageType: text('usage_type').notNull(),
        periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
        periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
        usedCount: integer('used_count').notNull().default(0),
        limitCount: integer('limit_count').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        userIdx: index('user_plan_usage_user_id_idx').on(table.userId),
        usagePeriodIdx: index('user_plan_usage_period_idx').on(table.userId, table.usageType, table.periodStart, table.periodEnd),
        uniqueUsagePeriod: uniqueIndex('user_plan_usage_unique_period').on(
            table.userId,
            table.planId,
            table.usageType,
            table.periodStart,
            table.periodEnd
        ),
    })
)

export type UserPlanUsage = typeof userPlanUsage.$inferSelect
export type NewUserPlanUsage = typeof userPlanUsage.$inferInsert
