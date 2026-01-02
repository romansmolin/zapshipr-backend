import { db } from '@/db/client'
import { PostsRepository } from '@/modules/post/repositories/posts.repository'
import { PostsService } from '@/modules/post/services/posts.service'
import { SocialMediaPublisherFactory } from '@/modules/social/factories/socia-media-publisher.factory'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { SocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.service'
import { SocialMediaTokenRefresherService } from '@/modules/social/services/social-media-token-refresher.service'
import { AxiosHttpClient } from '@/shared/http-client'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { VideoProcessor } from '@/shared/video-processor/video-processor'
import { ConsoleLogger } from '@/shared/logger/console-logger'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'
import { initializeWorkers } from '@/workers/workers.config'

async function startWorkers() {
    const logger = new ConsoleLogger()
    const accountRepository = new AccountRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const mediaUploader = new S3Uploader(logger)
    const apiClient = new AxiosHttpClient()
    const socialMediaErrorHandler = new SocialMediaErrorHandler(logger)
    const videoProcessor = new VideoProcessor(logger)
    const socialMediaPublisherFactory = new SocialMediaPublisherFactory(
        logger,
        accountRepository,
        postsRepository,
        apiClient,
        socialMediaErrorHandler,
        videoProcessor,
        mediaUploader
    )
    const socialMediaPostSender = new SocialMediaPostSenderService(
        postsRepository,
        logger,
        socialMediaErrorHandler,
        socialMediaPublisherFactory
    )
    const socialMediaTokenRefresher = new SocialMediaTokenRefresherService(logger, accountRepository)
    const postsService = new PostsService(
        postsRepository,
        mediaUploader,
        logger,
        socialMediaPostSender,
        socialMediaErrorHandler
    )

    await initializeWorkers(logger, db, socialMediaPostSender, socialMediaTokenRefresher, postsService)

    logger.info('BullMQ workers started successfully')
}

startWorkers().catch((error) => {
    console.error('Failed to start workers:', error)
    process.exit(1)
})
