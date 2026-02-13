import { Queue } from 'bullmq'

import { redisConnection } from '../redis'

import type { PostPreparationJobPayload } from '@/modules/post/services/posts-service.interface'
import type { IPostPreparationScheduler } from './post-preparation-scheduler.interface'

const PREPARATION_QUEUE_NAME = 'post-preparation'

export class BullMqPostPreparationScheduler implements IPostPreparationScheduler {
    private readonly queue: Queue<PostPreparationJobPayload>

    constructor() {
        this.queue = new Queue<PostPreparationJobPayload>(PREPARATION_QUEUE_NAME, {
            connection: redisConnection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: 100,
                removeOnFail: 200,
            },
        })
    }

    async schedulePostPreparation(payload: PostPreparationJobPayload): Promise<void> {
        const jobId = `prep_${payload.postId}`

        await this.queue.add('post-preparation', payload, {
            jobId,
        })
    }

    async close(): Promise<void> {
        await this.queue.close()
    }
}
