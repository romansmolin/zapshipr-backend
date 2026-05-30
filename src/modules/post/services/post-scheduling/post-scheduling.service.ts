import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import { PostStatus } from '@/modules/post/types/posts.types'
import { isValidTimeZone, parseDateWithTimeZone } from '@/shared/utils/timezone'

import type { IPostSchedulingService } from './post-scheduling-service.interface'
import type { PostPreparationJobPayload } from '../posts/posts-service.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import type { PostTarget } from '@/modules/post/types/posts.types'
import type { IPostPreparationScheduler, IPostScheduler } from '@/shared/queue'
import type { ILogger } from '@/shared/logger/logger.interface'

export class PostSchedulingService implements IPostSchedulingService {
    constructor(
        private readonly postRepository: IPostsRepository,
        private readonly postScheduler: IPostScheduler,
        private readonly postPreparationScheduler: IPostPreparationScheduler,
        private readonly logger: ILogger
    ) {}

    resolveScheduledTime(scheduledAtLocal?: string | null, timezone?: string | null): Date | null {
        if (!scheduledAtLocal || !timezone) return null
        if (!isValidTimeZone(timezone)) return null
        return parseDateWithTimeZone(scheduledAtLocal, timezone)
    }

    async schedulePostTargets(
        postId: string,
        userId: string,
        scheduledTime: Date,
        targets: PostTarget[]
    ): Promise<void> {
        if (targets.length === 0) return

        await Promise.all(
            targets.map((target) =>
                this.postScheduler.schedulePost(target.platform, postId, userId, scheduledTime, target.socialAccountId)
            )
        )
    }

    async cleanupScheduledJobs(
        postId: string,
        platforms: Iterable<SocilaMediaPlatform>,
        throwOnError: boolean
    ): Promise<void> {
        const uniquePlatforms = Array.from(new Set(platforms))
        if (uniquePlatforms.length === 0) return

        const results = await Promise.allSettled(
            uniquePlatforms.map((platform) => this.postScheduler.cleanupJobsForDeletedPost(platform, postId))
        )

        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

        if (failures.length > 0) {
            this.logger.error('Failed to cleanup scheduled jobs', {
                operation: 'cleanupScheduledJobs',
                postId,
                platforms: uniquePlatforms,
                failureCount: failures.length,
            })

            if (throwOnError) {
                throw new BaseAppError('Failed to cleanup scheduled jobs', ErrorCode.UNKNOWN_ERROR, 500)
            }
        }
    }

    async enqueuePostPreparation(payload: PostPreparationJobPayload): Promise<void> {
        const startedAt = Date.now()
        await this.postPreparationScheduler.schedulePostPreparation(payload)
        this.logger.info('post_queue_enqueue_ms', {
            operation: 'enqueuePostPreparation',
            postId: payload.postId,
            userId: payload.userId,
            metric: 'post_queue_enqueue_ms',
            value: Date.now() - startedAt,
        })
    }

    async enqueueImmediatePostTargets(
        postId: string,
        userId: string,
        postTargets: PostTarget[],
        mainCaption?: string | null
    ): Promise<void> {
        try {
            await this.schedulePostTargets(postId, userId, new Date(), postTargets)

            this.logger.info('Immediate post queued for background publishing', {
                operation: 'enqueueImmediatePostTargets',
                userId,
                postId,
                targetCount: postTargets.length,
            })
        } catch (error) {
            await this.cleanupScheduledJobs(
                postId,
                postTargets.map((target) => target.platform),
                false
            )

            await this.postRepository.updateBasePost(postId, userId, PostStatus.FAILED, mainCaption ?? null)

            this.logger.error('Failed to enqueue immediate post targets', {
                operation: 'enqueueImmediatePostTargets',
                userId,
                postId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to enqueue immediate post targets', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }
}
