import type { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import type { PostTarget } from '@/modules/post/types/posts.types'
import type { PostPreparationJobPayload } from '../posts/posts-service.interface'

export interface IPostSchedulingService {
    schedulePostTargets(
        postId: string,
        userId: string,
        scheduledTime: Date,
        targets: PostTarget[]
    ): Promise<void>

    cleanupScheduledJobs(
        postId: string,
        platforms: Iterable<SocilaMediaPlatform>,
        throwOnError: boolean
    ): Promise<void>

    resolveScheduledTime(scheduledAtLocal?: string | null, timezone?: string | null): Date | null

    enqueuePostPreparation(payload: PostPreparationJobPayload): Promise<void>

    enqueueImmediatePostTargets(
        postId: string,
        userId: string,
        postTargets: PostTarget[],
        mainCaption?: string | null
    ): Promise<void>
}
