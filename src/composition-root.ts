/**
 * Application composition root.
 *
 * Constructs every shared singleton (repositories, services, infra) exactly once
 * and returns them as a typed object. Entry points (server, worker) consume this
 * and pass the relevant slice into each `build<X>Module(...)`.
 *
 * Controllers and route definitions stay inside their module's `*.routes.ts` file.
 */
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'

import { AxiosHttpClient } from '@/shared/http-client'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { VideoProcessor } from '@/shared/video-processor/video-processor'
import { VideoConverter } from '@/shared/video-processor/video-converter'
import { ImageProcessor } from '@/shared/image-processor/image-processor'
import {
    BullMqPostScheduler,
    BullMqPostPreparationScheduler,
    BullMqInspirationScheduler,
} from '@/shared/queue'
import { getEnvVar } from '@/shared/utils/get-env-var'

import { NodemailerEmailService } from '@/modules/email/services/email.service'

// Repositories
import { UserRepository } from '@/modules/user/repositories/users.repository'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'
import { WorkspaceProfileSignalsRepository } from '@/modules/workspace/repositories/workspace-profile-signals.repository'
import { PostsRepository } from '@/modules/post/repositories/posts.repository'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { MediaRepository } from '@/modules/media/repositories/media.repository'
import { WorkspaceTagsRepository } from '@/modules/inspiration/repositories/workspace-tags.repository'
import { InspirationsRepository } from '@/modules/inspiration/repositories/inspirations.repository'
import { WaitlistRepository } from '@/modules/waitlist/repositories/waitlist.repository'

// Services
import { UserService } from '@/modules/user/services/user.service'
import { WorkspaceProfileService } from '@/modules/workspace/services/workspace-profile.service'
import { WorkspaceTagsService } from '@/modules/inspiration/services/workspace-tags/workspace-tags.service'
import { WorkspaceService } from '@/modules/workspace/services/workspace.service'
import { SocialMediaPublisherFactory } from '@/modules/social/factories/socia-media-publisher.factory'
import { SocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.service'
import { SocialMediaTokenRefresherService } from '@/modules/social/services/social-media-token-refresher.service'
import { PostsService } from '@/modules/post/services/posts.service'
import { PostMediaService } from '@/modules/post/services/post-media.service'
import { PostSchedulingService } from '@/modules/post/services/post-scheduling.service'
import { InspirationsService } from '@/modules/inspiration/services/inspirations.service'
import { ContentParserService } from '@/modules/inspiration/services/content-parser/content-parser.service'
import { MediaService } from '@/modules/media/services/media.service'
import { BillingService } from '@/modules/billing/services/billing.service'
import { AuthService } from '@/modules/auth/services/auth.service'
import { WaitlistService } from '@/modules/waitlist/services/waitlist.service'
import { JoinWaitlistUseCase } from '@/modules/waitlist/use-cases/join-waitlist.use-case'
import { AccountsService } from '@/modules/social/services/accounts.service'
import { SocilaMediaConnectorService } from '@/modules/social/services/social-media-connector.service'
import { OAuthStateService } from '@/modules/social/services/oauth-state.service'
import { AiService } from '@/modules/ai/services/ai.service'

// Social use cases (feed into AccountsService)
import { ConnectAccountUseCase } from '@/modules/social/use-cases/connect-account.use-case'
import { DeleteAccountUseCase } from '@/modules/social/use-cases/delete-account.use-case'
import { FindExpiringAccountsUseCase } from '@/modules/social/use-cases/find-expiring-accounts.use-case'
import { GetAccountByIdUseCase } from '@/modules/social/use-cases/get-account-by-id.use-case'
import { GetPinterestBoardsUseCase } from '@/modules/social/use-cases/get-pinterest-boards.use-case'
import { ListAccountsUseCase } from '@/modules/social/use-cases/list-accounts.use-case'
import { UpdateAccessTokenByIdUseCase } from '@/modules/social/use-cases/update-access-token-by-id.use-case'
import { UpdateAccessTokenUseCase } from '@/modules/social/use-cases/update-access-token.use-case'

import type { IApiClient } from '@/shared/http-client'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { IVideoProcessor } from '@/shared/video-processor/video-processor.interface'
import type {
    IPostScheduler,
    IPostPreparationScheduler,
    IInspirationScheduler,
} from '@/shared/queue'

import type { IEmailService } from '@/modules/email/services/email.service.interface'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

import type { IAuthService } from '@/modules/auth/services/auth-service.interface'
import type { IUserService } from '@/modules/user/services/user.service.interface'
import type { IWorkspaceProfileService } from '@/modules/workspace/services/workspace-profile.service'
import type { IWorkspaceService } from '@/modules/workspace/services/workspace-service.interface'
import type { IPostsService } from '@/modules/post/services/posts-service.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { ISocialMediaTokenRefresherService } from '@/modules/social/services/social-media-token-refresher.interface'
import type { IInspirationsService } from '@/modules/inspiration/services/inspirations-service.interface'
import type { IMediaService } from '@/modules/media/services/media-service.interface'
import type { IWaitlistService } from '@/modules/waitlist/services/waitlist.service.interface'
import type { IAccountsService } from '@/modules/social/services/accounts.service.interface'
import type { ISocilaMediaConnectorService } from '@/modules/social/services/social-media-connector.interface'
import type { IOAuthStateService } from '@/modules/social/services/oauth-state.service'
import type { IAiService } from '@/modules/ai/services/ai.service.interface'

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
    inspirationScheduler: IInspirationScheduler

    // Repositories
    userRepository: IUserRepository
    postsRepository: IPostsRepository
    accountRepository: IAccountRepository

    // Cross-cutting services
    userService: IUserService
    workspaceProfileService: IWorkspaceProfileService
    workspaceTagsService: WorkspaceTagsService
    socialMediaPostSender: ISocialMediaPostSenderService
    socialMediaTokenRefresher: ISocialMediaTokenRefresherService

    // Module-level services
    authService: IAuthService
    accountsService: IAccountsService
    socialMediaConnectorService: ISocilaMediaConnectorService
    oauthStateService: IOAuthStateService
    postsService: IPostsService
    workspaceService: IWorkspaceService
    inspirationsService: IInspirationsService
    mediaService: IMediaService
    billingService: BillingService
    waitlistService: IWaitlistService
    aiService: IAiService
}

export interface AppDepsInput {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
}

export const buildAppDeps = ({ db, logger }: AppDepsInput): AppDeps => {
    // ----- Infra -----
    const mediaUploader = new S3Uploader(logger)
    const apiClient = new AxiosHttpClient()
    const openaiApiClient = new AxiosHttpClient('https://api.openai.com/v1')
    const emailService = new NodemailerEmailService(logger)
    const videoProcessor = new VideoProcessor(logger)
    const videoConverter = new VideoConverter(logger)
    const imageProcessor = new ImageProcessor(logger)
    const socialMediaErrorHandler = new SocialMediaErrorHandler(logger)
    const postScheduler = new BullMqPostScheduler()
    const postPreparationScheduler = new BullMqPostPreparationScheduler()
    const inspirationScheduler = new BullMqInspirationScheduler()

    // ----- Repositories -----
    const userRepository = new UserRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const accountRepository = new AccountRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)
    const signalsRepository = new WorkspaceProfileSignalsRepository(db, logger)
    const tagsRepository = new WorkspaceTagsRepository(db, logger)
    const inspirationsRepository = new InspirationsRepository(db, logger)
    const waitlistRepository = new WaitlistRepository(db, logger)

    // ----- Cross-cutting services -----
    const workspaceTagsService = new WorkspaceTagsService(tagsRepository, logger)
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
        workspaceTagsService,
        logger
    )

    // ----- Social publishing pipeline -----
    const socialMediaPublisherFactory = new SocialMediaPublisherFactory(
        logger,
        accountRepository,
        postsRepository,
        apiClient,
        socialMediaErrorHandler,
        videoProcessor,
        mediaUploader,
        imageProcessor
    )
    const socialMediaPostSender = new SocialMediaPostSenderService(
        postsRepository,
        logger,
        socialMediaErrorHandler,
        socialMediaPublisherFactory
    )
    const socialMediaTokenRefresher = new SocialMediaTokenRefresherService(logger, accountRepository)

    // ----- Posts -----
    const postMediaService = new PostMediaService(
        postsRepository,
        mediaUploader,
        imageProcessor,
        videoConverter,
        videoProcessor,
        logger
    )
    const postSchedulingService = new PostSchedulingService(
        postsRepository,
        postScheduler,
        postPreparationScheduler,
        logger
    )
    const postsService = new PostsService(
        postsRepository,
        mediaUploader,
        logger,
        socialMediaPostSender,
        socialMediaErrorHandler,
        imageProcessor,
        postMediaService,
        postSchedulingService
    )

    // ----- Social accounts (use cases + service) -----
    const connectAccountUseCase = new ConnectAccountUseCase(accountRepository, logger, userService)
    const listAccountsUseCase = new ListAccountsUseCase(accountRepository, logger)
    const getAccountByIdUseCase = new GetAccountByIdUseCase(accountRepository, logger)
    const deleteAccountUseCase = new DeleteAccountUseCase(accountRepository, logger, mediaUploader, postsService)
    const getPinterestBoardsUseCase = new GetPinterestBoardsUseCase(accountRepository, logger)
    const updateAccessTokenUseCase = new UpdateAccessTokenUseCase(accountRepository, logger)
    const updateAccessTokenByIdUseCase = new UpdateAccessTokenByIdUseCase(accountRepository, logger)
    const findExpiringAccountsUseCase = new FindExpiringAccountsUseCase(accountRepository, logger)
    const accountsService = new AccountsService(
        connectAccountUseCase,
        listAccountsUseCase,
        getAccountByIdUseCase,
        deleteAccountUseCase,
        getPinterestBoardsUseCase,
        updateAccessTokenUseCase,
        updateAccessTokenByIdUseCase,
        findExpiringAccountsUseCase
    )
    const socialMediaConnectorService = new SocilaMediaConnectorService(
        logger,
        mediaUploader,
        accountRepository,
        apiClient,
        accountsService
    )
    const oauthStateService = new OAuthStateService(getEnvVar('OAUTH_STATE_SECRET'))

    // ----- Workspace -----
    const workspaceService = new WorkspaceService(
        workspaceRepository,
        mediaUploader,
        workspaceProfileService,
        userService,
        logger
    )

    // ----- Inspirations -----
    const contentParserService = new ContentParserService(logger)
    const inspirationsService = new InspirationsService(
        inspirationsRepository,
        mediaUploader,
        inspirationScheduler,
        contentParserService,
        logger
    )

    // ----- Media -----
    const mediaService = new MediaService(logger, mediaRepository, mediaUploader)

    // ----- Billing -----
    const billingService = new BillingService(db, userRepository, logger)

    // ----- Auth -----
    const authService = new AuthService(userRepository, emailService, logger)

    // ----- Waitlist -----
    const joinWaitlistUseCase = new JoinWaitlistUseCase(waitlistRepository, emailService, logger)
    const waitlistService = new WaitlistService(joinWaitlistUseCase)

    // ----- AI -----
    const aiService = new AiService(openaiApiClient, logger, userService, workspaceProfileService)

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
        inspirationScheduler,
        userRepository,
        postsRepository,
        accountRepository,
        userService,
        workspaceProfileService,
        workspaceTagsService,
        socialMediaPostSender,
        socialMediaTokenRefresher,
        authService,
        accountsService,
        socialMediaConnectorService,
        oauthStateService,
        postsService,
        workspaceService,
        inspirationsService,
        mediaService,
        billingService,
        waitlistService,
        aiService,
    }
}
