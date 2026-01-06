import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { PostPlatformsWithoutX } from '@/modules/post/schemas/posts.schemas'
import {
    BullMqAccessTokenWorker,
    BullMqPostWorker,
    BullMqTokenRefreshScheduler,
    BullMqInspirationWorker,
} from '@/shared/queue'
import { schema } from '@/db/schema'

import type { IPostsService } from '@/modules/post/services/posts-service.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { ISocialMediaTokenRefresherService } from '@/modules/social/services/social-media-token-refresher.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

import { InspirationsRepository } from '@/modules/inspiration/repositories/inspirations.repository'
import { InspirationsExtractionRepository } from '@/modules/inspiration/repositories/inspirations-extraction.repository'
import { BookExtractionRepository } from '@/modules/inspiration/repositories/book-extraction.repository'
import { WorkspaceTagsRepository } from '@/modules/inspiration/repositories/workspace-tags.repository'
import { ContentParserService } from '@/modules/inspiration/services/content-parser/content-parser.service'
import { LLMExtractionService } from '@/modules/inspiration/services/llm-extraction/llm-extraction.service'
import { ContentDetectionService } from '@/modules/inspiration/services/content-detection/content-detection.service'
import { BookIdentificationService } from '@/modules/inspiration/services/book-identification/book-identification.service'

export interface Workers {
    accessTokensRefreshScheduler: BullMqTokenRefreshScheduler
    accessTokensRefreshWorker: BullMqAccessTokenWorker
    postWorkers: BullMqPostWorker[]
    inspirationWorker: BullMqInspirationWorker
}

export async function initializeWorkers(
    logger: ILogger,
    db: NodePgDatabase<typeof schema>,
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

    // Initialize inspiration worker with book processing capabilities
    const inspirationsRepository = new InspirationsRepository(db, logger)
    const extractionsRepository = new InspirationsExtractionRepository(db, logger)
    const bookExtractionsRepository = new BookExtractionRepository(db)
    const tagsRepository = new WorkspaceTagsRepository(db, logger)
    const contentParser = new ContentParserService(logger)
    const llmExtraction = new LLMExtractionService(logger)
    const contentDetection = new ContentDetectionService(logger)
    const bookIdentification = new BookIdentificationService(logger)

    const inspirationWorker = new BullMqInspirationWorker(
        logger,
        db,
        inspirationsRepository,
        extractionsRepository,
        bookExtractionsRepository,
        tagsRepository,
        contentParser,
        llmExtraction,
        contentDetection,
        bookIdentification
    )
    inspirationWorker.start()

    return {
        accessTokensRefreshScheduler,
        accessTokensRefreshWorker,
        postWorkers,
        inspirationWorker,
    }
}
