import 'dotenv/config'

import { sql } from 'drizzle-orm'

import { db } from '@/db/client'

async function main() {
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7)

    await db.execute(sql`
        UPDATE user_plans
        SET plan_name = 'STARTER',
            billing_status = 'trialing',
            end_date = ${trialEnd},
            updated_at = now()
        WHERE upper(plan_name) = 'FREE'
          AND coalesce(is_active, true) = true
    `)

    console.log('[backfill-user-plans] migrated FREE users to STARTER trial successfully')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[backfill-user-plans] failed:', error instanceof Error ? error.message : String(error))
        process.exit(1)
    })
