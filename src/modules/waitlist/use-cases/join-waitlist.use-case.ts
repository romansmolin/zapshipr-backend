import { v4 as uuidv4 } from 'uuid'

import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IEmailService } from '@/modules/email/services/email.service.interface'
import { WaitlistEntry } from '@/modules/waitlist/entity/waitlist-entry'
import type { IWaitlistRepository } from '@/modules/waitlist/repositories/waitlist.repository.interface'
import type { WaitlistJoinResult } from '@/modules/waitlist/services/waitlist.service.interface'

export interface JoinWaitlistInput {
    email: string
    referralCode?: string
    referrerWaitlistId?: string
}

export class JoinWaitlistUseCase {
    private readonly referralThreshold = 10

    constructor(
        private readonly repository: IWaitlistRepository,
        private readonly emailService: IEmailService,
        private readonly logger: ILogger
    ) {}

    private buildReferralLink(referralCode: string): string {
        const frontendUrl = (process.env.FRONTEND_URL || '').trim()
        const normalizedBase = frontendUrl ? frontendUrl.replace(/\/$/, '') : 'http://localhost:3000'
        return `${normalizedBase}/?ref=${encodeURIComponent(referralCode)}`
    }

    async execute(payload: JoinWaitlistInput): Promise<WaitlistJoinResult> {
        const normalizedEmail = payload.email.trim().toLowerCase()

        if (!normalizedEmail) {
            throw new BaseAppError('Email is required', ErrorCode.BAD_REQUEST, 400)
        }

        const entryDraft = new WaitlistEntry(
            uuidv4(),
            payload.email.trim(),
            normalizedEmail,
            'ACTIVE',
            uuidv4(),
            null,
            null,
            new Date(),
            new Date()
        )

        let waitlistEntry = await this.repository.createEntry(entryDraft)
        let created = true

        if (!waitlistEntry) {
            created = false
            waitlistEntry = await this.repository.findByEmailNormalized(normalizedEmail)
        }

        if (!waitlistEntry) {
            throw new BaseAppError('Failed to join waitlist', ErrorCode.UNKNOWN_ERROR, 500)
        }

        const referralLink = this.buildReferralLink(waitlistEntry.referralCode)
        const referralCount = await this.repository.countReferrals(waitlistEntry.id)

        if (created) {
            await this.applyReferralIfEligible(waitlistEntry, payload.referralCode, payload.referrerWaitlistId)

            await this.emailService.sendWaitlistConfirmationEmail({
                to: waitlistEntry.email,
                referralLink,
            })

            this.logger.info('Waitlist confirmation email sent', {
                operation: 'waitlist_join',
                email: waitlistEntry.email,
                waitlistEntryId: waitlistEntry.id,
            })
        }

        return {
            status: created ? 'joined' : 'already_joined',
            referralCode: waitlistEntry.referralCode,
            referralLink,
            referralCount,
        }
    }

    private async applyReferralIfEligible(
        waitlistEntry: WaitlistEntry,
        referralCode?: string,
        referrerWaitlistId?: string
    ): Promise<void> {
        const trimmedReferralCode = referralCode?.trim()
        const trimmedReferrerId = referrerWaitlistId?.trim()

        if (!trimmedReferralCode && !trimmedReferrerId) {
            return
        }

        let referrer: WaitlistEntry | null = null

        if (trimmedReferralCode) {
            referrer = await this.repository.findByReferralCode(trimmedReferralCode)
        } else if (trimmedReferrerId) {
            referrer = await this.repository.findById(trimmedReferrerId)
        }

        if (!referrer) {
            this.logger.warn('Waitlist referral ignored due to missing referrer', {
                operation: 'waitlist_referral',
                referralCode: trimmedReferralCode,
                referrerWaitlistId: trimmedReferrerId,
            })
            return
        }

        if (referrer.id === waitlistEntry.id) {
            this.logger.warn('Waitlist referral ignored because referrer matches entry', {
                operation: 'waitlist_referral',
                waitlistEntryId: waitlistEntry.id,
            })
            return
        }

        const applied = await this.repository.applyReferral({
            referrerId: referrer.id,
            referredEntryId: waitlistEntry.id,
        })

        if (!applied) {
            this.logger.info('Waitlist referral was not applied', {
                operation: 'waitlist_referral',
                waitlistEntryId: waitlistEntry.id,
                referrerId: referrer.id,
            })
            return
        }

        const totalReferrals = await this.repository.countReferrals(referrer.id)

        if (totalReferrals < this.referralThreshold) {
            return
        }

        const reward = await this.repository.createReward({
            waitlistEntryId: referrer.id,
            type: 'SIX_MONTHS_FREE',
            status: 'GRANTED',
            grantedAt: new Date(),
            meta: {
                referralsThreshold: this.referralThreshold,
            },
        })

        if (reward) {
            this.logger.info('Waitlist referral reward granted', {
                operation: 'waitlist_reward_granted',
                waitlistEntryId: referrer.id,
                rewardId: reward.id,
            })
        }
    }
}
