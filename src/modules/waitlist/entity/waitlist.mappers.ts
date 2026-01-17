import type { WaitlistEntryRow } from './waitlist.schema'
import { WaitlistEntry } from './waitlist-entry'
import type { WaitlistStatus } from './waitlist.types'

export const toWaitlistEntry = (row: WaitlistEntryRow): WaitlistEntry => {
    return new WaitlistEntry(
        row.id,
        row.email,
        row.emailNormalized,
        row.status as WaitlistStatus,
        row.referralCode,
        row.referredById ?? null,
        row.referredAt ?? null,
        row.createdAt,
        row.updatedAt
    )
}
