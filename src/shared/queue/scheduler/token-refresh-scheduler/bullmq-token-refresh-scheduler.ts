import { Queue } from 'bullmq'

import { redisConnection } from '../redis'

import type { ITokenRefreshScheduler } from './token-refresh.interface'

export class BullMqTokenRefreshScheduler implements ITokenRefreshScheduler {
    private accessTokenRefreshQueue: Queue

    constructor() {
        this.accessTokenRefreshQueue = new Queue('check-expiring-tokens', { connection: redisConnection })
    }

    async scheduleDailyAccessTokenRefresh(): Promise<void> {
        await this.accessTokenRefreshQueue.waitUntilReady()

        await this.accessTokenRefreshQueue.upsertJobScheduler(
            'refresh-access-tokens',
            {
                every: 60_000,
                immediately: true,
            },
            {
                name: 'refresh-access-tokens',
                data: {},
                opts: {
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            }
        )

        console.log('[Access Token Scheduler] repeat job registered (every 60s)')
    }
}
