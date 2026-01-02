import type { WaitlistRewardStatus, WaitlistRewardType } from './waitlist.types'

export class WaitlistReferralReward {
    id: string
    waitlistEntryId: string
    type: WaitlistRewardType
    status: WaitlistRewardStatus
    grantedAt: Date | null
    meta: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date

    constructor(
        id: string,
        waitlistEntryId: string,
        type: WaitlistRewardType,
        status: WaitlistRewardStatus,
        grantedAt: Date | null,
        meta: Record<string, unknown> | null,
        createdAt: Date,
        updatedAt: Date
    ) {
        this.id = id
        this.waitlistEntryId = waitlistEntryId
        this.type = type
        this.status = status
        this.grantedAt = grantedAt
        this.meta = meta
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
