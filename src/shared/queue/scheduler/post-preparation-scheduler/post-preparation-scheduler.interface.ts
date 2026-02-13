import type { PostPreparationJobPayload } from '@/modules/post/services/posts-service.interface'

export interface IPostPreparationScheduler {
    schedulePostPreparation(payload: PostPreparationJobPayload): Promise<void>
    close(): Promise<void>
}
