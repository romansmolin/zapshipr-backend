import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import type { IUserService } from '@/modules/user/services/user.service.interface'
import type { IPostsService } from '@/modules/post/services/posts-service.interface'

import type { Account } from '@/modules/social/entity/account'
import type { PinterestBoard } from '@/modules/social/entity/pinterest-board'
import type { SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { SocialTokenSnapshot } from '@/modules/social/entity/social-account.types'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

import { connectAccount as connectAccountUseCase } from '@/modules/social/use-cases/connect-account.use-case'
import { listAccounts as listAccountsUseCase } from '@/modules/social/use-cases/list-accounts.use-case'
import { getAccountById as getAccountByIdUseCase } from '@/modules/social/use-cases/get-account-by-id.use-case'
import { deleteAccount as deleteAccountUseCase } from '@/modules/social/use-cases/delete-account.use-case'
import { getPinterestBoards as getPinterestBoardsUseCase } from '@/modules/social/use-cases/get-pinterest-boards.use-case'
import { updateAccessToken as updateAccessTokenUseCase } from '@/modules/social/use-cases/update-access-token.use-case'
import { updateAccessTokenById as updateAccessTokenByIdUseCase } from '@/modules/social/use-cases/update-access-token-by-id.use-case'
import { findExpiringAccounts as findExpiringAccountsUseCase } from '@/modules/social/use-cases/find-expiring-accounts.use-case'

import type { AccountTokenPayload, ConnectAccountResult, IAccountsService } from './accounts.service.interface'

type AccountsDeps = {
    accounts: IAccountRepository
    mediaUploader: IMediaUploader
    postsService: IPostsService
    userService: IUserService
    logger: ILogger
}

export class AccountsService implements IAccountsService {
    private readonly deps: AccountsDeps

    constructor(
        accountRepository: IAccountRepository,
        mediaUploader: IMediaUploader,
        postsService: IPostsService,
        userService: IUserService,
        logger: ILogger
    ) {
        this.deps = { accounts: accountRepository, mediaUploader, postsService, userService, logger }
    }

    connectAccount(account: Account): Promise<ConnectAccountResult> {
        return connectAccountUseCase(this.deps, { account })
    }

    listAccounts(userId: string): Promise<SocialAccountResponse[]> {
        return listAccountsUseCase(this.deps, { userId })
    }

    getAllAccounts(userId: string, workspaceId: string): Promise<SocialAccountResponse[]> {
        return listAccountsUseCase(this.deps, { userId, workspaceId })
    }

    getAccountById(userId: string, accountId: string): Promise<SocialAccountResponse> {
        return getAccountByIdUseCase(this.deps, { userId, accountId })
    }

    deleteAccount(userId: string, workspaceId: string, accountId: string): Promise<{ success: boolean }> {
        return deleteAccountUseCase(this.deps, { userId, workspaceId, accountId })
    }

    getPinterestBoards(userId: string, workspaceId: string, socialAccountId: string): Promise<PinterestBoard[]> {
        return getPinterestBoardsUseCase(this.deps, { userId, workspaceId, socialAccountId })
    }

    updateAccessToken(userId: string, pageId: string, accessToken: string): Promise<void> {
        return updateAccessTokenUseCase(this.deps, { userId, pageId, accessToken })
    }

    updateAccessTokenByAccountId(accountId: string, payload: AccountTokenPayload): Promise<void> {
        return updateAccessTokenByIdUseCase(this.deps, {
            accountId,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresIn: payload.expiresIn,
            refreshTokenExpiresIn: payload.refreshTokenExpiresIn,
        })
    }

    findAccountsWithExpiringAccessTokens(): Promise<SocialTokenSnapshot[]> {
        return findExpiringAccountsUseCase(this.deps)
    }
}
