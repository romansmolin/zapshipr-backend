import type { WaitlistEntryRow, WaitlistReferralRewardRow } from './waitlist.schema'
import { WaitlistEntry } from './waitlist-entry'
import { WaitlistReferralReward } from './waitlist-referral-reward'
import type { WaitlistRewardStatus, WaitlistRewardType, WaitlistStatus } from './waitlist.types'

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

export const toWaitlistReferralReward = (row: WaitlistReferralRewardRow): WaitlistReferralReward => {
    return new WaitlistReferralReward(
        row.id,
        row.waitlistEntryId,
        row.type as WaitlistRewardType,
        row.status as WaitlistRewardStatus,
        row.grantedAt ?? null,
        (row.meta as Record<string, unknown> | null) ?? null,
        row.createdAt,
        row.updatedAt
    )
}
