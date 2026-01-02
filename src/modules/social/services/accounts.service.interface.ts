import type { Account } from '@/modules/social/entity/account'
import type { PinterestBoard } from '@/modules/social/entity/pinterest-board'
import type { SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { SocialTokenSnapshot } from '@/modules/social/entity/social-account.types'

export interface AccountTokenPayload {
    accessToken: string
    refreshToken: string | null
    expiresIn: Date | null
    refreshTokenExpiresIn: Date | null
}

export interface ConnectAccountResult {
    isNew: boolean
    account: SocialAccountResponse
}

export interface IAccountsService {
    connectAccount(account: Account): Promise<ConnectAccountResult>
    listAccounts(userId: string): Promise<SocialAccountResponse[]>
    getAllAccounts(userId: string): Promise<SocialAccountResponse[]>
    getAccountById(userId: string, accountId: string): Promise<SocialAccountResponse>
    deleteAccount(userId: string, accountId: string): Promise<{ success: boolean }>
    getPinterestBoards(userId: string, socialAccountId: string): Promise<PinterestBoard[]>
    updateAccessToken(userId: string, pageId: string, accessToken: string): Promise<void>
    updateAccessTokenByAccountId(accountId: string, payload: AccountTokenPayload): Promise<void>
    findAccountsWithExpiringAccessTokens(): Promise<SocialTokenSnapshot[]>
}
