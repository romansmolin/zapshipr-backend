"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthStateService = void 0;
const crypto_1 = require("crypto");
class OAuthStateService {
    constructor(ttlMs = 10 * 60 * 1000) {
        this.store = new Map();
        this.ttlMs = ttlMs;
    }
    create(payload) {
        const state = (0, crypto_1.randomUUID)();
        this.store.set(state, { payload, expiresAt: Date.now() + this.ttlMs });
        return state;
    }
    consume(state) {
        const entry = this.store.get(state);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(state);
            return null;
        }
        this.store.delete(state);
        return entry.payload;
    }
}
exports.OAuthStateService = OAuthStateService;
