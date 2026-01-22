import { TikTokCreatorInfoDto } from '@/modules/social/types/account.types'

export interface ITikTokConnectorService {
    connectTikTokAccount(userId: string, code: string): Promise<{ success: boolean }>
    getTikTokCreatorInfo(userId: string, socialAccountId: string): Promise<TikTokCreatorInfoDto>
}
