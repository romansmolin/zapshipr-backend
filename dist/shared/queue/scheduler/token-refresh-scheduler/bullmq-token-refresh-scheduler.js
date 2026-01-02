"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMqTokenRefreshScheduler = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../redis");
class BullMqTokenRefreshScheduler {
    constructor() {
        this.accessTokenRefreshQueue = new bullmq_1.Queue('check-expiring-tokens', { connection: redis_1.redisConnection });
    }
    async scheduleDailyAccessTokenRefresh() {
        await this.accessTokenRefreshQueue.waitUntilReady();
        await this.accessTokenRefreshQueue.add('refresh-access-tokens', {}, {
            jobId: 'refresh-access-tokens',
            removeOnComplete: true,
            removeOnFail: false,
            repeat: { every: 60000 },
        });
        console.log('[Access Token Scheduler] repeat job registered (every 60s)');
    }
}
exports.BullMqTokenRefreshScheduler = BullMqTokenRefreshScheduler;
