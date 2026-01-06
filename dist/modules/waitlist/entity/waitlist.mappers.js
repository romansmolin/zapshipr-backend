"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWaitlistReferralReward = exports.toWaitlistEntry = void 0;
const waitlist_entry_1 = require("./waitlist-entry");
const waitlist_referral_reward_1 = require("./waitlist-referral-reward");
const toWaitlistEntry = (row) => {
    return new waitlist_entry_1.WaitlistEntry(row.id, row.email, row.emailNormalized, row.status, row.referralCode, row.referredById ?? null, row.referredAt ?? null, row.createdAt, row.updatedAt);
};
exports.toWaitlistEntry = toWaitlistEntry;
const toWaitlistReferralReward = (row) => {
    return new waitlist_referral_reward_1.WaitlistReferralReward(row.id, row.waitlistEntryId, row.type, row.status, row.grantedAt ?? null, row.meta ?? null, row.createdAt, row.updatedAt);
};
exports.toWaitlistReferralReward = toWaitlistReferralReward;
