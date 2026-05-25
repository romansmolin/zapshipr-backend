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
import { bindController } from '@/shared/http/bind-controller'
import { getEnvVar } from '@/shared/utils/get-env-var'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { UserService } from '@/modules/user/services/user.service'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'
import { MediaRepository } from '@/modules/media/repositories/media.repository'

import type { IApiClient } from '@/shared/http-client'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader'

export interface AccountsModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    mediaUploader: IMediaUploader
    apiClient: IApiClient
}

export interface AccountsModule {
    router: Router
}

export const buildAccountsModule = ({ db, logger, mediaUploader, apiClient }: AccountsModuleDeps): AccountsModule => {
    const router = createRouter()

    const accountRepository = new AccountRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const userRepository = new UserRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)
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
    const handler = bindController(accountsController)

    // OAuth callbacks (no workspace scope - external providers call these)
    router.get('/facebook/authorize', authMiddleware, handler('initiateOAuth'))
    router.get('/facebook/callback', handler('connectFacebookAccount'))
    router.get('/threads/callback', handler('connectThreadsAccount'))
    router.get('/tiktok/callback', handler('connectTikTokAccount'))
    router.get('/youtube/callback', handler('connectYouTubeAccount'))
    router.get('/x/callback', handler('connectXAccount'))
    router.get('/pinterest/callback', handler('connectPinterestAccount'))
    router.get('/instagram/callback', handler('connectInstagramAccount'))
    router.get('/linkedin/callback', handler('connectLinkedinAccount'))

    // Authenticated but not workspace-scoped
    router.post('/oauth/state', authMiddleware, handler('createOAuthState'))
    router.post('/bluesky/connect', authMiddleware, handler('connectBlueskyAccount'))

    // Workspace-scoped account routes
    router.get(
        '/workspaces/:workspaceId/accounts',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('getAllAccounts')
    )
    router.delete(
        '/workspaces/:workspaceId/accounts/:accountId',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('deleteAccount')
    )
    router.get(
        '/workspaces/:workspaceId/accounts/:socialAccountId/pinterest-boards',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('getPinterestBoards')
    )
    router.get(
        '/workspaces/:workspaceId/accounts/:socialAccountId/tiktok/creator-info',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('getTikTokCreatorInfo')
    )

    return { router }
}
