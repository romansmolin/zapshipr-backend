import { Queue } from 'bullmq'
import { redisConnection } from '../redis'
import type { IYoutubeCleanupScheduler } from './youtube-cleanup.interface'

const QUEUE_NAME = 'youtube-data-cleanup'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export class BullMqYoutubeCleanupScheduler implements IYoutubeCleanupScheduler {
    private queue: Queue

    constructor() {
        this.queue = new Queue(QUEUE_NAME, { connection: redisConnection })
    }

    async scheduleYoutubeDataCleanup(): Promise<void> {
        await this.queue.waitUntilReady()

        await this.queue.upsertJobScheduler(
            'cleanup-youtube-data',
            {
                every: THIRTY_DAYS_MS,
                immediately: true,
            },
            {
                name: 'cleanup-youtube-data',
                data: {},
                opts: {
                    removeOnComplete: true,
                    removeOnFail: true,
                },
            }
        )

        console.log('[YouTube Cleanup Scheduler] Daily cleanup job registered (every 30 days)')
    }
}
