import { Queue, Worker, type Job } from 'bullmq'

import { redisConnection } from '../../scheduler/redis'
import type { IYoutubeCleanupWorker } from './youtube-cleanup-worker.interface'
import type { ITranscriptRepository } from '@/modules/inspiration/repositories/transcript-repository.interface'
import type { IInspirationsRepository } from '@/modules/inspiration/repositories/inspirations-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

const QUEUE_NAME = 'youtube-data-cleanup'
const RETENTION_DAYS = 30

export class BullMqYoutubeCleanupWorker implements IYoutubeCleanupWorker {
    private worker: Worker
    private queue: Queue
    private transcriptRepository: ITranscriptRepository
    private inspirationsRepository: IInspirationsRepository
    private logger: ILogger

    private async cleanupExpiredYoutubeData(job: Job): Promise<void> {
        this.logger.info('[YouTube Cleanup Worker] Processing job', { jobId: job.id })

        const olderThan = new Date()
        olderThan.setDate(olderThan.getDate() - RETENTION_DAYS)

        const [deletedTranscripts, clearedStats] = await Promise.all([
            this.transcriptRepository.deleteExpiredTranscripts(olderThan),
            this.inspirationsRepository.clearExpiredYoutubeStats(olderThan),
        ])

        this.logger.info('[YouTube Cleanup Worker] YouTube ToS cleanup complete', {
            jobId: job.id,
            deletedTranscripts,
            clearedStats,
            olderThan: olderThan.toISOString(),
        })
    }

    constructor(logger: ILogger, transcriptRepository: ITranscriptRepository, inspirationsRepository: IInspirationsRepository) {
        this.logger = logger
        this.transcriptRepository = transcriptRepository
        this.inspirationsRepository = inspirationsRepository

        this.queue = new Queue(QUEUE_NAME, { connection: redisConnection })

        this.worker = new Worker(
            QUEUE_NAME,
            async (job) => this.cleanupExpiredYoutubeData(job),
            { connection: redisConnection }
        )
    }

    start(): void {
        this.worker.on('completed', (job) => {
            this.logger.info('[YouTube Cleanup Worker] Job completed', { jobId: job.id })
        })

        this.worker.on('failed', (job, err) => {
            this.logger.error('[YouTube Cleanup Worker] Job failed', {
                jobId: job?.id,
                reason: err instanceof Error ? err.message : 'Unknown error',
                error: {
                    name: err instanceof Error ? err.name : 'Unknown Error',
                    stack: err instanceof Error ? err.stack : undefined,
                },
            })
        })

        this.worker.on('error', (err) => {
            this.logger.error('[YouTube Cleanup Worker] Worker error', {
                reason: err instanceof Error ? err.message : 'Unknown error',
                error: {
                    name: err instanceof Error ? err.name : 'Unknown Error',
                    stack: err instanceof Error ? err.stack : undefined,
                },
            })
        })

        this.logger.info('[YouTube Cleanup Worker] Started (YouTube ToS: 30-day data retention)')
    }

    async stop(): Promise<void> {
        await this.queue.close()
        await this.worker.close()
    }
}
