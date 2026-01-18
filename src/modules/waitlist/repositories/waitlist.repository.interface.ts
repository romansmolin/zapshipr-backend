import type { WaitlistEntry } from '@/modules/waitlist/entity/waitlist-entry'

export interface IWaitlistRepository {
    createEntry(entry: WaitlistEntry): Promise<WaitlistEntry | null>
    findByEmailNormalized(emailNormalized: string): Promise<WaitlistEntry | null>
    findByReferralCode(referralCode: string): Promise<WaitlistEntry | null>
    findById(entryId: string): Promise<WaitlistEntry | null>
    applyReferral(params: { referrerId: string; referredEntryId: string }): Promise<boolean>
    countReferrals(referrerId: string): Promise<number>
}
