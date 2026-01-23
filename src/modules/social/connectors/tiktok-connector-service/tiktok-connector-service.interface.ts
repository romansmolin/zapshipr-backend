import { TikTokCreatorInfoDto } from '@/modules/social/types/account.types'

export interface ITikTokConnectorService {
    connectTikTokAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }>
    getTikTokCreatorInfo(userId: string, workspaceId: string, socialAccountId: string): Promise<TikTokCreatorInfoDto>
}
