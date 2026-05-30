import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { PLAN_LIMITS } from '@/shared/consts/plan-limits.const'
import { normalizeUserPlan } from '@/shared/consts/plans'

import type { IUserRepository } from '../repositories/user-repository.interface'

import { getUserPlan } from './get-user-plan.use-case'
import { resolveUsagePeriod } from './_helpers'

export type IncrementAiUsageDeps = {
    users: IUserRepository
    db: NodePgDatabase<typeof dbSchema>
}

export const incrementAiUsage = async (deps: IncrementAiUsageDeps, userId: string): Promise<void> => {
    const { db } = deps

    const plan = await getUserPlan(deps, userId)
    if (!plan) {
        throw new BaseAppError('Unable to resolve user plan', ErrorCode.UNKNOWN_ERROR, 500)
    }

    const normalizedPlan = normalizeUserPlan(plan.planName)
    const limits = PLAN_LIMITS[normalizedPlan]
    const period = resolveUsagePeriod(plan)

    await db.transaction(async (tx) => {
        const existingUsageResult = await tx.execute(sql`
            SELECT id, used_count, limit_count
            FROM user_plan_usage
            WHERE user_id = ${userId}
              AND plan_id = ${plan.id}
              AND usage_type = 'ai'
              AND period_start = ${period.start}
              AND period_end = ${period.end}
            LIMIT 1
            FOR UPDATE
        `)

        const existingUsageRow = existingUsageResult.rows[0] as
            | { id: string; used_count: number | string; limit_count: number | string }
            | undefined

        let usageId = existingUsageRow?.id
        let usedCount = Number(existingUsageRow?.used_count ?? 0)
        let limitCount = Number(existingUsageRow?.limit_count ?? limits.aiActionsPerMonth)

        if (!usageId) {
            usageId = randomUUID()
            usedCount = 0
            limitCount = limits.aiActionsPerMonth

            await tx.execute(sql`
                INSERT INTO user_plan_usage (
                    id,
                    user_id,
                    plan_id,
                    usage_type,
                    period_start,
                    period_end,
                    used_count,
                    limit_count,
                    created_at,
                    updated_at
                ) VALUES (
                    ${usageId},
                    ${userId},
                    ${plan.id},
                    'ai',
                    ${period.start},
                    ${period.end},
                    0,
                    ${limitCount},
                    now(),
                    now()
                )
            `)
        }

        if (usedCount >= limitCount) {
            throw new BaseAppError(
                'AI actions limit reached for your current plan',
                ErrorCode.PLAN_LIMIT_REACHED,
                403
            )
        }

        await tx.execute(sql`
            UPDATE user_plan_usage
            SET used_count = used_count + 1,
                updated_at = now()
            WHERE id = ${usageId}
        `)
    })
}
