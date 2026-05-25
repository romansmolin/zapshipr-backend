import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth.middleware'
import { createWorkspaceMiddleware } from '@/middleware/workspace.middleware'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { AccountsController } from '@/modules/social/controllers/accounts.controller'
import { AccountsService } from '@/modules/social/services/accounts.service'
import { OAuthStateService } from '@/modules/social/services/oauth-state.service'
import { SocilaMediaConnectorService } from '@/modules/social/services/social-media-connector.service'
import { PostsRepository } from '@/modules/post/repositories/posts.repository'
import { PostsService } from '@/modules/post/services/posts.service'
import { ConnectAccountUseCase } from '@/modules/social/use-cases/connect-account.use-case'
import { DeleteAccountUseCase } from '@/modules/social/use-cases/delete-account.use-case'
import { FindExpiringAccountsUseCase } from '@/modules/social/use-cases/find-expiring-accounts.use-case'
import { GetAccountByIdUseCase } from '@/modules/social/use-cases/get-account-by-id.use-case'
import { GetPinterestBoardsUseCase } from '@/modules/social/use-cases/get-pinterest-boards.use-case'
import { ListAccountsUseCase } from '@/modules/social/use-cases/list-accounts.use-case'
import { UpdateAccessTokenByIdUseCase } from '@/modules/social/use-cases/update-access-token-by-id.use-case'
import { UpdateAccessTokenUseCase } from '@/modules/social/use-cases/update-access-token.use-case'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { asyncHandler } from '@/shared/http/async-handler'
import { AxiosHttpClient } from '@/shared/http-client/axios-http-client'
import type { ILogger } from '@/shared/logger/logger.interface'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'
import { getEnvVar } from '@/shared/utils/get-env-var'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { UserService } from '@/modules/user/services/user.service'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'
import { MediaRepository } from '@/modules/media/repositories/media.repository'

export const createAccountsRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const accountRepository = new AccountRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const userRepository = new UserRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)
    const mediaUploader = new S3Uploader(logger)
    const apiClient = new AxiosHttpClient()
    const socialMediaErrorHandler = new SocialMediaErrorHandler(logger)

    // Account deletion only needs post cleanup methods; publishing methods are not used here.
    const noopPostSender: ISocialMediaPostSenderService = {
        async sendPost(_userId: string, _postId: string, _platform: SocilaMediaPlatform, _socialAccountId?: string) {
            return
        },
        async sendPostToAllPlatforms(_userId: string, _postId: string) {
            return
        },
        setOnPostSuccessCallback(_callback: (userId: string, postId: string) => Promise<void>) {
            return
        },
        setOnPostFailureCallback(_callback: (userId: string, postId: string) => Promise<void>) {
            return
        },
    }

    const postsService = new PostsService(postsRepository, mediaUploader, logger, noopPostSender, socialMediaErrorHandler)
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

    const connectAccountUseCase = new ConnectAccountUseCase(accountRepository, logger, userService)
    const listAccountsUseCase = new ListAccountsUseCase(accountRepository, logger)
    const getAccountByIdUseCase = new GetAccountByIdUseCase(accountRepository, logger)
    const deleteAccountUseCase = new DeleteAccountUseCase(
        accountRepository,
        logger,
        mediaUploader,
        postsService
    )
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

    const connectorService = new SocilaMediaConnectorService(
        logger,
        mediaUploader,
        accountRepository,
        apiClient,
        accountsService
    )

    const oauthStateSecret = getEnvVar('OAUTH_STATE_SECRET')
    const oauthStateService = new OAuthStateService(oauthStateSecret)
    const accountsController = new AccountsController(accountsService, connectorService, logger, oauthStateService)
    const workspaceMiddleware = createWorkspaceMiddleware(logger, db)

    // OAuth callbacks (no workspace scope - external providers call these)
    router.get(
        '/facebook/authorize',
        authMiddleware,
        asyncHandler(accountsController.initiateOAuth.bind(accountsController))
    )
    router.get(
        '/facebook/callback',
        asyncHandler(accountsController.connectFacebookAccount.bind(accountsController))
    )
    router.get(
        '/threads/callback',
        asyncHandler(accountsController.connectThreadsAccount.bind(accountsController))
    )
    router.get('/tiktok/callback', asyncHandler(accountsController.connectTikTokAccount.bind(accountsController)))
    router.get(
        '/youtube/callback',
        asyncHandler(accountsController.connectYouTubeAccount.bind(accountsController))
    )
    router.get('/x/callback', asyncHandler(accountsController.connectXAccount.bind(accountsController)))
    router.get(
        '/pinterest/callback',
        asyncHandler(accountsController.connectPinterestAccount.bind(accountsController))
    )
    router.get(
        '/instagram/callback',
        asyncHandler(accountsController.connectInstagramAccount.bind(accountsController))
    )
    router.get(
        '/linkedin/callback',
        asyncHandler(accountsController.connectLinkedinAccount.bind(accountsController))
    )

    // Authenticated but not workspace-scoped (OAuth state creation, Bluesky connect)
    router.post(
        '/oauth/state',
        authMiddleware,
        asyncHandler(accountsController.createOAuthState.bind(accountsController))
    )
    router.post(
        '/bluesky/connect',
        authMiddleware,
        asyncHandler(accountsController.connectBlueskyAccount.bind(accountsController))
    )

    // Workspace-scoped account routes
    router.get(
        '/workspaces/:workspaceId/accounts',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        asyncHandler(accountsController.getAllAccounts.bind(accountsController))
    )
    router.delete(
        '/workspaces/:workspaceId/accounts/:accountId',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        asyncHandler(accountsController.deleteAccount.bind(accountsController))
    )
    router.get(
        '/workspaces/:workspaceId/accounts/:socialAccountId/pinterest-boards',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        asyncHandler(accountsController.getPinterestBoards.bind(accountsController))
    )
    router.get(
        '/workspaces/:workspaceId/accounts/:socialAccountId/tiktok/creator-info',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        asyncHandler(accountsController.getTikTokCreatorInfo.bind(accountsController))
    )

    return router
}
