import 'dotenv/config'

import { sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { PLAN_LIMITS } from '@/shared/consts/plan-limits.const'
import { normalizeUserPlan } from '@/shared/consts/plans'

interface ActivePlanRow {
    plan_id: string
    user_id: string
    plan_name: string
    start_date: string | Date
    current_period_end: string | Date | null
    files: number
    storage_bytes: string // bigint comes back as string from pg
}

function resolveUsagePeriod(rawStart: string | Date, rawEnd: string | Date | null): { start: Date; end: Date } {
    const now = new Date()
    const startDate = new Date(rawStart)
    const periodEnd = rawEnd ? new Date(rawEnd) : null

    if (periodEnd && periodEnd.getTime() > now.getTime() && startDate < periodEnd) {
        return { start: startDate, end: periodEnd }
    }

    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
    return { start, end }
}

async function main() {
    const result = await db.execute(sql`
        SELECT
            up.id        AS plan_id,
            up.user_id,
            up.plan_name,
            up.start_date,
            up.current_period_end,
            count(DISTINCT ma.id)::int                              AS files,
            coalesce(sum(coalesce(ma.size_bytes, 0)), 0)::bigint    AS storage_bytes
        FROM user_plans up
        LEFT JOIN posts p              ON p.user_id = up.user_id
        LEFT JOIN post_media_assets pma ON pma.post_id = p.id
        LEFT JOIN media_assets ma       ON ma.id = pma.media_asset_id
        WHERE up.is_active = true
        GROUP BY up.id, up.user_id, up.plan_name, up.start_date, up.current_period_end
    `)

    const rows = result.rows as unknown as ActivePlanRow[]
    let upserted = 0

    for (const row of rows) {
        const plan = normalizeUserPlan(row.plan_name)
        const limits = PLAN_LIMITS[plan]
        const period = resolveUsagePeriod(row.start_date, row.current_period_end)

        const filesCount = Number(row.files)
        const storageBytesCount = Number(row.storage_bytes)
        const INT_MAX = 2_147_483_647
        const storageLimit = Math.min(limits.storageBytesLimit, INT_MAX)
        const storageUsed = Math.min(storageBytesCount, INT_MAX)

        await db.execute(sql`
            INSERT INTO user_plan_usage (id, user_id, plan_id, usage_type, period_start, period_end, used_count, limit_count, created_at, updated_at)
            VALUES (gen_random_uuid(), ${row.user_id}, ${row.plan_id}, 'files', ${period.start}, ${period.end}, ${filesCount}, ${limits.filesLimit}, now(), now())
            ON CONFLICT (user_id, plan_id, usage_type, period_start, period_end)
            DO UPDATE SET used_count = EXCLUDED.used_count, limit_count = EXCLUDED.limit_count, updated_at = now()
        `)

        await db.execute(sql`
            INSERT INTO user_plan_usage (id, user_id, plan_id, usage_type, period_start, period_end, used_count, limit_count, created_at, updated_at)
            VALUES (gen_random_uuid(), ${row.user_id}, ${row.plan_id}, 'storage_bytes', ${period.start}, ${period.end}, ${storageUsed}, ${storageLimit}, now(), now())
            ON CONFLICT (user_id, plan_id, usage_type, period_start, period_end)
            DO UPDATE SET used_count = EXCLUDED.used_count, limit_count = EXCLUDED.limit_count, updated_at = now()
        `)

        upserted += 2
    }

    console.log(`[backfill-media-usage] completed — processed ${rows.length} plans, upserted ${upserted} usage rows`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[backfill-media-usage] failed:', error)
        process.exit(1)
    })
