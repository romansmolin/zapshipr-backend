import type { Account } from '@/modules/social/entity/account'
import type { PinterestBoard } from '@/modules/social/entity/pinterest-board'
import type { SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { SocialTokenSnapshot } from '@/modules/social/entity/social-account.types'

import type { ConnectAccountUseCase } from '@/modules/social/use-cases/connect-account.use-case'
import type { DeleteAccountUseCase } from '@/modules/social/use-cases/delete-account.use-case'
import type { FindExpiringAccountsUseCase } from '@/modules/social/use-cases/find-expiring-accounts.use-case'
import type { GetAccountByIdUseCase } from '@/modules/social/use-cases/get-account-by-id.use-case'
import type { GetPinterestBoardsUseCase } from '@/modules/social/use-cases/get-pinterest-boards.use-case'
import type { ListAccountsUseCase } from '@/modules/social/use-cases/list-accounts.use-case'
import type { UpdateAccessTokenByIdUseCase } from '@/modules/social/use-cases/update-access-token-by-id.use-case'
import type { UpdateAccessTokenUseCase } from '@/modules/social/use-cases/update-access-token.use-case'

import type { AccountTokenPayload, ConnectAccountResult, IAccountsService } from './accounts.service.interface'

export class AccountsService implements IAccountsService {
    private readonly connectAccountUseCase: ConnectAccountUseCase
    private readonly listAccountsUseCase: ListAccountsUseCase
    private readonly getAccountByIdUseCase: GetAccountByIdUseCase
    private readonly deleteAccountUseCase: DeleteAccountUseCase
    private readonly getPinterestBoardsUseCase: GetPinterestBoardsUseCase
    private readonly updateAccessTokenUseCase: UpdateAccessTokenUseCase
    private readonly updateAccessTokenByIdUseCase: UpdateAccessTokenByIdUseCase
    private readonly findExpiringAccountsUseCase: FindExpiringAccountsUseCase

    constructor(
        connectAccountUseCase: ConnectAccountUseCase,
        listAccountsUseCase: ListAccountsUseCase,
        getAccountByIdUseCase: GetAccountByIdUseCase,
        deleteAccountUseCase: DeleteAccountUseCase,
        getPinterestBoardsUseCase: GetPinterestBoardsUseCase,
        updateAccessTokenUseCase: UpdateAccessTokenUseCase,
        updateAccessTokenByIdUseCase: UpdateAccessTokenByIdUseCase,
        findExpiringAccountsUseCase: FindExpiringAccountsUseCase
    ) {
        this.connectAccountUseCase = connectAccountUseCase
        this.listAccountsUseCase = listAccountsUseCase
        this.getAccountByIdUseCase = getAccountByIdUseCase
        this.deleteAccountUseCase = deleteAccountUseCase
        this.getPinterestBoardsUseCase = getPinterestBoardsUseCase
        this.updateAccessTokenUseCase = updateAccessTokenUseCase
        this.updateAccessTokenByIdUseCase = updateAccessTokenByIdUseCase
        this.findExpiringAccountsUseCase = findExpiringAccountsUseCase
    }

    async connectAccount(account: Account): Promise<ConnectAccountResult> {
        return this.connectAccountUseCase.execute({ account })
    }

    async listAccounts(userId: string): Promise<SocialAccountResponse[]> {
        return this.listAccountsUseCase.execute({ userId })
    }

    async getAllAccounts(userId: string, workspaceId: string): Promise<SocialAccountResponse[]> {
        return this.listAccountsUseCase.execute({ userId, workspaceId })
    }

    async getAccountById(userId: string, accountId: string): Promise<SocialAccountResponse> {
        return this.getAccountByIdUseCase.execute({ userId, accountId })
    }

    async deleteAccount(userId: string, workspaceId: string, accountId: string): Promise<{ success: boolean }> {
        return this.deleteAccountUseCase.execute({ userId, workspaceId, accountId })
    }

    async getPinterestBoards(userId: string, workspaceId: string, socialAccountId: string): Promise<PinterestBoard[]> {
        return this.getPinterestBoardsUseCase.execute({ userId, workspaceId, socialAccountId })
    }

    async updateAccessToken(userId: string, pageId: string, accessToken: string): Promise<void> {
        await this.updateAccessTokenUseCase.execute({ userId, pageId, accessToken })
    }

    async updateAccessTokenByAccountId(accountId: string, payload: AccountTokenPayload): Promise<void> {
        await this.updateAccessTokenByIdUseCase.execute({
            accountId,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresIn: payload.expiresIn,
            refreshTokenExpiresIn: payload.refreshTokenExpiresIn,
        })
    }

    async findAccountsWithExpiringAccessTokens(): Promise<SocialTokenSnapshot[]> {
        return this.findExpiringAccountsUseCase.execute()
    }
}
