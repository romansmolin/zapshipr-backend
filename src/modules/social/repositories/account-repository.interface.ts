import type { Account } from '@/modules/social/entity/account'
import type { PinterestBoard } from '@/modules/social/entity/pinterest-board'
import type { SocialPlatform } from '@/modules/social/entity/social-account.schema'
import type { SocialTokenSnapshot } from '@/modules/social/entity/social-account.types'

export interface AccountUpdateInput {
    userId: string
    workspaceId: string
    platform: SocialPlatform
    pageId: string
    username: string
    accessToken: string
    connectedAt: Date
    picture?: string | null
    refreshToken?: string | null
    expiresIn?: Date | null
    refreshExpiresIn?: Date | null
    maxVideoPostDurationSec?: number | null
    privacyLevelOptions?: string[] | null
}

export interface IAccountRepository {
    save(account: Account): Promise<Account>
    findByTenantPlatformAndPage(
        userId: string,
        platform: SocialPlatform,
        pageId: string
    ): Promise<Account | null>
    updateAccountByTenantPlatformAndPage(input: AccountUpdateInput): Promise<Account>
    findByUserId(userId: string, workspaceId?: string): Promise<Account[]>
    findByUserIdAndPlatform(userId: string, platform: SocialPlatform, workspaceId?: string): Promise<Account[]>
    getAllAccounts(userId: string, workspaceId?: string): Promise<Account[]>
    updateAccessToken(userId: string, pageId: string, newAccessToken: string): Promise<void>
    updateAccessTokenByAccountId(
        accountId: string,
        expiresIn: Date | null,
        accessToken: string,
        refreshToken: string | null,
        refreshTokenExpiresIn: Date | null
    ): Promise<void>
    deleteAccount(userId: string, accountId: string): Promise<boolean>
    getAccountById(userId: string, accountId: string): Promise<Account | null>
    getAccountByUserIdAndSocialAccountId(userId: string, socialAccountId: string): Promise<Account>
    findAccountsWithExpiringAccessTokens(): Promise<{ accountsSnapshots: SocialTokenSnapshot[] }>
    savePinterestBoard(board: PinterestBoard): Promise<PinterestBoard>
    deletePinterestBoardsByAccountId(userId: string, socialAccountId: string): Promise<void>
    getPinterestBoards(userId: string, socialAccountId: string): Promise<PinterestBoard[]>
}
