import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth.middleware'
import { createWorkspaceMiddleware } from '@/middleware/workspace.middleware'
import { asyncHandler } from '@/shared/http/async-handler'
import { bindController } from '@/shared/http/bind-controller'

import { AccountsController } from '@/modules/social/controllers/accounts.controller'

import type { IAccountsService } from '@/modules/social/services/accounts/accounts.service.interface'
import type { ISocilaMediaConnectorService } from '@/modules/social/services/social-media-connector/social-media-connector.interface'
import type { IOAuthStateService } from '@/modules/social/services/oauth-state/oauth-state.service'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface AccountsModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    accountsService: IAccountsService
    socialMediaConnectorService: ISocilaMediaConnectorService
    oauthStateService: IOAuthStateService
}

export interface AccountsModule {
    router: Router
}

export const buildAccountsModule = ({
    db,
    logger,
    accountsService,
    socialMediaConnectorService,
    oauthStateService,
}: AccountsModuleDeps): AccountsModule => {
    const router = createRouter()
    const accountsController = new AccountsController(
        accountsService,
        socialMediaConnectorService,
        logger,
        oauthStateService
    )
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
