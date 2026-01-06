"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinWaitlistUseCase = void 0;
const uuid_1 = require("uuid");
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const waitlist_entry_1 = require("@/modules/waitlist/entity/waitlist-entry");
class JoinWaitlistUseCase {
    constructor(repository, emailService, logger) {
        this.repository = repository;
        this.emailService = emailService;
        this.logger = logger;
        this.referralThreshold = 10;
    }
    buildReferralLink(referralCode) {
        const frontendUrl = (process.env.FRONTEND_URL || '').trim();
        const normalizedBase = frontendUrl ? frontendUrl.replace(/\/$/, '') : 'http://localhost:3000';
        return `${normalizedBase}/?ref=${encodeURIComponent(referralCode)}`;
    }
    async execute(payload) {
        const normalizedEmail = payload.email.trim().toLowerCase();
        if (!normalizedEmail) {
            throw new base_error_1.BaseAppError('Email is required', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        const entryDraft = new waitlist_entry_1.WaitlistEntry((0, uuid_1.v4)(), payload.email.trim(), normalizedEmail, 'ACTIVE', (0, uuid_1.v4)(), null, null, new Date(), new Date());
        let waitlistEntry = await this.repository.createEntry(entryDraft);
        let created = true;
        if (!waitlistEntry) {
            created = false;
            waitlistEntry = await this.repository.findByEmailNormalized(normalizedEmail);
        }
        if (!waitlistEntry) {
            throw new base_error_1.BaseAppError('Failed to join waitlist', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        const referralLink = this.buildReferralLink(waitlistEntry.referralCode);
        const referralCount = await this.repository.countReferrals(waitlistEntry.id);
        if (created) {
            await this.applyReferralIfEligible(waitlistEntry, payload.referralCode, payload.referrerWaitlistId);
            await this.emailService.sendWaitlistConfirmationEmail({
                to: waitlistEntry.email,
                referralLink,
            });
            this.logger.info('Waitlist confirmation email sent', {
                operation: 'waitlist_join',
                email: waitlistEntry.email,
                waitlistEntryId: waitlistEntry.id,
            });
        }
        return {
            status: created ? 'joined' : 'already_joined',
            referralCode: waitlistEntry.referralCode,
            referralLink,
            referralCount,
        };
    }
    async applyReferralIfEligible(waitlistEntry, referralCode, referrerWaitlistId) {
        const trimmedReferralCode = referralCode?.trim();
        const trimmedReferrerId = referrerWaitlistId?.trim();
        if (!trimmedReferralCode && !trimmedReferrerId) {
            return;
        }
        let referrer = null;
        if (trimmedReferralCode) {
            referrer = await this.repository.findByReferralCode(trimmedReferralCode);
        }
        else if (trimmedReferrerId) {
            referrer = await this.repository.findById(trimmedReferrerId);
        }
        if (!referrer) {
            this.logger.warn('Waitlist referral ignored due to missing referrer', {
                operation: 'waitlist_referral',
                referralCode: trimmedReferralCode,
                referrerWaitlistId: trimmedReferrerId,
            });
            return;
        }
        if (referrer.id === waitlistEntry.id) {
            this.logger.warn('Waitlist referral ignored because referrer matches entry', {
                operation: 'waitlist_referral',
                waitlistEntryId: waitlistEntry.id,
            });
            return;
        }
        const applied = await this.repository.applyReferral({
            referrerId: referrer.id,
            referredEntryId: waitlistEntry.id,
        });
        if (!applied) {
            this.logger.info('Waitlist referral was not applied', {
                operation: 'waitlist_referral',
                waitlistEntryId: waitlistEntry.id,
                referrerId: referrer.id,
            });
            return;
        }
        const totalReferrals = await this.repository.countReferrals(referrer.id);
        if (totalReferrals < this.referralThreshold) {
            return;
        }
        const reward = await this.repository.createReward({
            waitlistEntryId: referrer.id,
            type: 'SIX_MONTHS_FREE',
            status: 'GRANTED',
            grantedAt: new Date(),
            meta: {
                referralsThreshold: this.referralThreshold,
            },
        });
        if (reward) {
            this.logger.info('Waitlist referral reward granted', {
                operation: 'waitlist_reward_granted',
                waitlistEntryId: referrer.id,
                rewardId: reward.id,
            });
        }
    }
}
exports.JoinWaitlistUseCase = JoinWaitlistUseCase;
