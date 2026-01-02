import type { SocialPlatform } from './social-account.schema'

export interface SocialTokenSnapshot {
    id: string
    platform: SocialPlatform
    accessToken: string
    refreshToken: string | null
}
