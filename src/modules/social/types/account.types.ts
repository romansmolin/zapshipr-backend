export interface IPinterestBoardResponse {
    items?: Array<{
        id: string
        name: string
        description?: string | null
        privacy?: string | null
        owner?: {
            username?: string | null
        }
        media?: {
            image_cover_url?: string | null
        }
    }>
}

export interface TikTokCreatorInfoDto {
    creatorId: string
    nickname: string | null
    canPostNow: boolean
    privacyLevelOptions: string[]
    maxVideoPostDurationSec: number
    interactions: {
        allowComment: boolean
        allowDuet: boolean
        allowStitch: boolean
    }
}
