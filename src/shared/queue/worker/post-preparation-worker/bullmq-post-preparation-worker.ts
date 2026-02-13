import { Worker, type Job } from 'bullmq'

import { redisConnection } from '../../scheduler/redis'

import type { IPostPreparationWorker } from './post-preparation-worker.interface'
import type { PostPreparationJobPayload } from '@/modules/post/services/posts-service.interface'
import type { IPostsService } from '@/modules/post/services/posts-service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

const PREPARATION_QUEUE_NAME = 'post-preparation'

export class BullMqPostPreparationWorker implements IPostPreparationWorker {
    private readonly worker: Worker<PostPreparationJobPayload>

    constructor(
        private readonly logger: ILogger,
        private readonly postsService: IPostsService
    ) {
        this.worker = new Worker<PostPreparationJobPayload>(
            PREPARATION_QUEUE_NAME,
            async (job) => this.handleJob(job),
            {
                connection: redisConnection,
                concurrency: 4,
            }
        )
    }

    private async handleJob(job: Job<PostPreparationJobPayload>): Promise<void> {
        const startedAt = Date.now()
        const payload = job.data

        this.logger.info('Starting post preparation job', {
            operation: 'BullMqPostPreparationWorker.handleJob',
            jobId: job.id,
            postId: payload.postId,
            userId: payload.userId,
            transformCount: payload.mediaTransforms.length,
            selectedMediaCount: payload.selectedMediaIndices.length,
        })

        try {
            await this.postsService.processPostPreparationJob(payload)

            this.logger.info('Post preparation job completed', {
                operation: 'BullMqPostPreparationWorker.handleJob',
                jobId: job.id,
                postId: payload.postId,
                durationMs: Date.now() - startedAt,
            })
        } catch (error) {
            this.logger.error('Post preparation job failed', {
                operation: 'BullMqPostPreparationWorker.handleJob',
                jobId: job.id,
                postId: payload.postId,
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
            throw error
        }
    }

    start(): void {
        this.worker.on('error', (error) => {
            this.logger.error('Post preparation worker error', {
                operation: 'BullMqPostPreparationWorker.start',
                error: error.message,
            })
        })

        this.logger.info('Post preparation worker started', {
            operation: 'BullMqPostPreparationWorker.start',
            queue: PREPARATION_QUEUE_NAME,
        })
    }

    async stop(): Promise<void> {
        await this.worker.close()
    }
}
