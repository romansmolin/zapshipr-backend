"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitlistEntry = void 0;
class WaitlistEntry {
    constructor(id, email, emailNormalized, status, referralCode, referredById, referredAt, createdAt, updatedAt) {
        this.id = id;
        this.email = email;
        this.emailNormalized = emailNormalized;
        this.status = status;
        this.referralCode = referralCode;
        this.referredById = referredById;
        this.referredAt = referredAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
exports.WaitlistEntry = WaitlistEntry;
