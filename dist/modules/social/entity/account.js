"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Account = void 0;
class Account {
    constructor(id, userId, workspaceId, platform, username, accessToken, connectedAt, pageId, picture, refreshToken, expiresIn, refreshExpiresIn, maxVideoPostDurationSec, privacyLevelOptions) {
        this.id = id;
        this.userId = userId;
        this.workspaceId = workspaceId;
        this.platform = platform;
        this.username = username;
        this.accessToken = accessToken;
        this.connectedAt = connectedAt;
        this.pageId = pageId;
        this.picture = picture ?? null;
        this.refreshToken = refreshToken ?? null;
        this.expiresIn = expiresIn ?? null;
        this.refreshExpiresIn = refreshExpiresIn ?? null;
        this.maxVideoPostDurationSec = maxVideoPostDurationSec ?? null;
        this.privacyLevelOptions = privacyLevelOptions ?? null;
    }
    get tenantId() {
        return this.userId;
    }
    get connectedDate() {
        return this.connectedAt;
    }
}
exports.Account = Account;
