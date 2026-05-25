/**
 * Application composition root.
 *
 * Constructs every shared singleton (repositories, cross-cutting services, infra)
 * exactly once and returns them as a typed object. Entry points (server, worker)
 * consume this and pass the relevant slice into each `build<X>Module(...)`.
 */
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'

import { AxiosHttpClient } from '@/shared/http-client'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { VideoProcessor } from '@/shared/video-processor/video-processor'
import { BullMqPostScheduler, BullMqPostPreparationScheduler } from '@/shared/queue'

import { NodemailerEmailService } from '@/modules/email/services/email.service'

import { UserRepository } from '@/modules/user/repositories/users.repository'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'
import { WorkspaceProfileSignalsRepository } from '@/modules/workspace/repositories/workspace-profile-signals.repository'
import { PostsRepository } from '@/modules/post/repositories/posts.repository'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { MediaRepository } from '@/modules/media/repositories/media.repository'
import { WorkspaceTagsRepository } from '@/modules/inspiration/repositories/workspace-tags.repository'

import { UserService } from '@/modules/user/services/user.service'
import { WorkspaceProfileService } from '@/modules/workspace/services/workspace-profile.service'
import { WorkspaceTagsService } from '@/modules/inspiration/services/workspace-tags/workspace-tags.service'
import { SocialMediaPublisherFactory } from '@/modules/social/factories/socia-media-publisher.factory'
import { SocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.service'
import { PostsService } from '@/modules/post/services/posts.service'

import type { IApiClient } from '@/shared/http-client'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { IVideoProcessor } from '@/shared/video-processor/video-processor.interface'
import type { IPostScheduler, IPostPreparationScheduler } from '@/shared/queue'

import type { IEmailService } from '@/modules/email/services/email.service.interface'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

import type { IUserService } from '@/modules/user/services/user.service.interface'
import type { IWorkspaceProfileService } from '@/modules/workspace/services/workspace-profile.service'
import type { IPostsService } from '@/modules/post/services/posts-service.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'

export interface AppDeps {
    // Infra
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    mediaUploader: IMediaUploader
    apiClient: IApiClient
    emailService: IEmailService
    videoProcessor: IVideoProcessor
    socialMediaErrorHandler: SocialMediaErrorHandler

    // Schedulers
    postScheduler: IPostScheduler
    postPreparationScheduler: IPostPreparationScheduler

    // Repositories
    userRepository: IUserRepository
    postsRepository: IPostsRepository
    accountRepository: IAccountRepository

    // Services
    userService: IUserService
    workspaceProfileService: IWorkspaceProfileService
    socialMediaPostSender: ISocialMediaPostSenderService
    postsService: IPostsService
}

export interface AppDepsInput {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
}

export const buildAppDeps = ({ db, logger }: AppDepsInput): AppDeps => {
    // Shared infra
    const mediaUploader = new S3Uploader(logger)
    const apiClient = new AxiosHttpClient()
    const emailService = new NodemailerEmailService(logger)
    const videoProcessor = new VideoProcessor(logger)
    const socialMediaErrorHandler = new SocialMediaErrorHandler(logger)
    const postScheduler = new BullMqPostScheduler()
    const postPreparationScheduler = new BullMqPostPreparationScheduler()

    // Repositories
    const userRepository = new UserRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const accountRepository = new AccountRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)
    const signalsRepository = new WorkspaceProfileSignalsRepository(db, logger)
    const tagsRepository = new WorkspaceTagsRepository(db, logger)

    // Cross-cutting services
    const tagsService = new WorkspaceTagsService(tagsRepository, logger)
    const userService = new UserService(
        userRepository,
        workspaceRepository,
        postsRepository,
        accountRepository,
        mediaRepository,
        mediaUploader,
        db,
        logger
    )
    const workspaceProfileService = new WorkspaceProfileService(
        workspaceRepository,
        signalsRepository,
        tagsService,
        logger
    )

    // Social publishing pipeline (used by both posts and workers)
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

    // Posts (fully wired — no more partial construction)
    const postsService = new PostsService(
        postsRepository,
        mediaUploader,
        logger,
        socialMediaPostSender,
        socialMediaErrorHandler,
        postScheduler,
        postPreparationScheduler,
        workspaceProfileService,
        userService
    )

    return {
        db,
        logger,
        mediaUploader,
        apiClient,
        emailService,
        videoProcessor,
        socialMediaErrorHandler,
        postScheduler,
        postPreparationScheduler,
        userRepository,
        postsRepository,
        accountRepository,
        userService,
        workspaceProfileService,
        socialMediaPostSender,
        postsService,
    }
}
