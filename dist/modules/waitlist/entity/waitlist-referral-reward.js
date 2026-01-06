"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitlistReferralReward = void 0;
class WaitlistReferralReward {
    constructor(id, waitlistEntryId, type, status, grantedAt, meta, createdAt, updatedAt) {
        this.id = id;
        this.waitlistEntryId = waitlistEntryId;
        this.type = type;
        this.status = status;
        this.grantedAt = grantedAt;
        this.meta = meta;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
exports.WaitlistReferralReward = WaitlistReferralReward;
