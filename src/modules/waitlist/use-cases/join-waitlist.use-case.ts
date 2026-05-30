import { v4 as uuidv4 } from 'uuid'

import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IEmailService } from '@/modules/email/services/email/email.service.interface'
import { WaitlistEntry } from '@/modules/waitlist/entity/waitlist-entry'
import type { IWaitlistRepository } from '@/modules/waitlist/repositories/waitlist.repository.interface'
import type { WaitlistJoinResult } from '@/modules/waitlist/services/waitlist/waitlist.service.interface'

export interface JoinWaitlistInput {
    email: string
    referralCode?: string
    referrerWaitlistId?: string
}

export type JoinWaitlistDeps = {
    waitlist: IWaitlistRepository
    emailService: IEmailService
    logger: ILogger
}

const buildReferralLink = (referralCode: string): string => {
    const frontendUrl = (process.env.FRONTEND_URL || '').trim()
    const normalizedBase = frontendUrl ? frontendUrl.replace(/\/$/, '') : 'http://localhost:3000'
    return `${normalizedBase}/?ref=${encodeURIComponent(referralCode)}`
}

const applyReferralIfEligible = async (
    deps: JoinWaitlistDeps,
    waitlistEntry: WaitlistEntry,
    referralCode?: string,
    referrerWaitlistId?: string
): Promise<void> => {
    const { waitlist, logger } = deps
    const trimmedReferralCode = referralCode?.trim()
    const trimmedReferrerId = referrerWaitlistId?.trim()

    if (!trimmedReferralCode && !trimmedReferrerId) {
        return
    }

    let referrer: WaitlistEntry | null = null

    if (trimmedReferralCode) referrer = await waitlist.findByReferralCode(trimmedReferralCode)
    else if (trimmedReferrerId) referrer = await waitlist.findById(trimmedReferrerId)

    if (!referrer) {
        logger.warn('Waitlist referral ignored due to missing referrer', {
            operation: 'waitlist_referral',
            referralCode: trimmedReferralCode,
            referrerWaitlistId: trimmedReferrerId,
        })
        return
    }

    if (referrer.id === waitlistEntry.id) {
        logger.warn('Waitlist referral ignored because referrer matches entry', {
            operation: 'waitlist_referral',
            waitlistEntryId: waitlistEntry.id,
        })
        return
    }

    const applied = await waitlist.applyReferral({
        referrerId: referrer.id,
        referredEntryId: waitlistEntry.id,
    })

    if (!applied) {
        logger.info('Waitlist referral was not applied', {
            operation: 'waitlist_referral',
            waitlistEntryId: waitlistEntry.id,
            referrerId: referrer.id,
        })
    }
}

export const joinWaitlist = async (
    deps: JoinWaitlistDeps,
    payload: JoinWaitlistInput
): Promise<WaitlistJoinResult> => {
    const { waitlist, emailService, logger } = deps
    const normalizedEmail = payload.email.trim().toLowerCase()

    if (!normalizedEmail) throw new BaseAppError('Email is required', ErrorCode.BAD_REQUEST, 400)

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

    let waitlistEntry = await waitlist.createEntry(entryDraft)
    let created = true

    if (!waitlistEntry) {
        created = false
        waitlistEntry = await waitlist.findByEmailNormalized(normalizedEmail)
    }

    if (!waitlistEntry) throw new BaseAppError('Failed to join waitlist', ErrorCode.UNKNOWN_ERROR, 500)

    const referralLink = buildReferralLink(waitlistEntry.referralCode)
    const referralCount = await waitlist.countReferrals(waitlistEntry.id)

    if (created) {
        await applyReferralIfEligible(deps, waitlistEntry, payload.referralCode, payload.referrerWaitlistId)

        await emailService.sendWaitlistConfirmationEmail({
            to: waitlistEntry.email,
            referralLink,
        })

        logger.info('Waitlist confirmation email sent', {
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
