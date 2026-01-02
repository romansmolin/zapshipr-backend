import type {
    NewPinterestBoard,
    NewSocialAccount,
    PinterestBoard,
    SocialAccount,
    SocialPlatform,
} from '../entity/social-account.schema'
import type { SocialTokenSnapshot } from '../entity/social-account.types'

export interface SocialAccountUpdateInput {
    username?: string
    accessToken?: string
    refreshToken?: string | null
    picture?: string | null
    connectedDate?: Date | null
    expiresIn?: Date | null
    refreshExpiresIn?: Date | null
    maxVideoPostDurationSec?: number | null
    privacyLevelOptions?: string[] | null
}

export interface ISocialAccountsRepository {
    saveAccount(account: NewSocialAccount): Promise<SocialAccount>
    findByUserPlatformAndPage(
        userId: string,
        platform: SocialPlatform,
        pageId: string
    ): Promise<SocialAccount | null>
    updateAccountByUserPlatformAndPage(
        userId: string,
        platform: SocialPlatform,
        pageId: string,
        updates: SocialAccountUpdateInput
    ): Promise<SocialAccount>
    findByUserId(userId: string, workspaceId?: string): Promise<SocialAccount[]>
    findByUserIdAndPlatform(userId: string, platform: SocialPlatform, workspaceId?: string): Promise<SocialAccount[]>
    getAllAccounts(userId: string, workspaceId?: string): Promise<SocialAccount[]>
    updateAccessToken(userId: string, pageId: string, newAccessToken: string): Promise<void>
    updateAccessTokenByAccountId(
        accountId: string,
        expiresIn: Date | null,
        accessToken: string,
        refreshToken: string | null,
        refreshTokenExpiresIn: Date | null
    ): Promise<void>
    deleteAccount(userId: string, accountId: string): Promise<void>
    getAccountById(userId: string, accountId: string): Promise<SocialAccount | null>
    getAccountByUserIdAndSocialAccountId(
        userId: string,
        socialAccountId: string
    ): Promise<SocialAccount | null>
    findAccountsWithExpiringAccessTokens(): Promise<SocialTokenSnapshot[]>
    savePinterestBoard(board: NewPinterestBoard): Promise<PinterestBoard>
    deletePinterestBoardsByAccountId(userId: string, socialAccountId: string): Promise<void>
    getPinterestBoards(userId: string, socialAccountId: string): Promise<PinterestBoard[]>
}
