import type { WaitlistEntry } from '@/modules/waitlist/entity/waitlist-entry'
import type { WaitlistReferralReward } from '@/modules/waitlist/entity/waitlist-referral-reward'
import type { WaitlistRewardStatus, WaitlistRewardType } from '@/modules/waitlist/entity/waitlist.types'

export interface IWaitlistRepository {
    createEntry(entry: WaitlistEntry): Promise<WaitlistEntry | null>
    findByEmailNormalized(emailNormalized: string): Promise<WaitlistEntry | null>
    findByReferralCode(referralCode: string): Promise<WaitlistEntry | null>
    findById(entryId: string): Promise<WaitlistEntry | null>
    applyReferral(params: { referrerId: string; referredEntryId: string }): Promise<boolean>
    countReferrals(referrerId: string): Promise<number>
    createReward(params: {
        waitlistEntryId: string
        type: WaitlistRewardType
        status: WaitlistRewardStatus
        meta?: Record<string, unknown> | null
        grantedAt?: Date | null
    }): Promise<WaitlistReferralReward | null>
}
