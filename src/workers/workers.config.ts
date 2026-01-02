import { PostPlatformsWithoutX } from '@/modules/post/schemas/posts.schemas'
import { BullMqAccessTokenWorker, BullMqPostWorker, BullMqTokenRefreshScheduler } from '@/shared/queue'

import type { IPostsService } from '@/modules/post/services/posts-service.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { ISocialMediaTokenRefresherService } from '@/modules/social/services/social-media-token-refresher.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface Workers {
    accessTokensRefreshScheduler: BullMqTokenRefreshScheduler
    accessTokensRefreshWorker: BullMqAccessTokenWorker
    postWorkers: BullMqPostWorker[]
}

export async function initializeWorkers(
    logger: ILogger,
    socialMediaPostSender: ISocialMediaPostSenderService,
    socialMediaTokenRefresher: ISocialMediaTokenRefresherService,
    postsService: IPostsService
): Promise<Workers> {
    const accessTokensRefreshScheduler = new BullMqTokenRefreshScheduler()
    await accessTokensRefreshScheduler.scheduleDailyAccessTokenRefresh()

    const postWorkers = PostPlatformsWithoutX.map((platform) => {
        const worker = new BullMqPostWorker(platform, socialMediaPostSender)
        // Set up failure callback to update base post status
        console.log(`[WORKERS] Setting up failure callback for ${platform}, postsService:`, !!postsService)
        worker.setOnJobFailureCallback(postsService.checkAndUpdateBasePostStatus.bind(postsService))
        worker.start()
        return worker
    })

    const accessTokensRefreshWorker = new BullMqAccessTokenWorker(logger, socialMediaTokenRefresher)
    accessTokensRefreshWorker.start()

    return {
        accessTokensRefreshScheduler,
        accessTokensRefreshWorker,
        postWorkers,
    }
}
