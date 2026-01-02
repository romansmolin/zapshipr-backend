import type { PostStatus, TikTokPrivacyLevel } from '@/modules/post/types/posts.types'

export enum SocilaMediaPlatform {
    FACEBOOK = 'facebook',
    INSTAGRAM = 'instagram',
    THREADS = 'threads',
    PINTEREST = 'pinterest',
    TIKTOK = 'tiktok',
    YOUTUBE = 'youtube',
    X = 'x',
    LINKEDIN = 'linkedin',
    BLUESKY = 'bluesky',
}

export type PostPlatform = SocilaMediaPlatform

export const PostPlatforms = Object.values(SocilaMediaPlatform) as PostPlatform[]
export const PostPlatformsWithoutX = PostPlatforms.filter((platform) => platform !== SocilaMediaPlatform.X)

export type PostType = 'text' | 'media'

export interface CreatePostTargetRequest {
    account: string
    platform: PostPlatform
    text?: string | null
    title?: string | null
    tags?: string[] | null
    links?: string[] | null
    threadsReplies?: string[] | null
    pinterestBoardId?: string | null
    tikTokPostPrivacyLevel?: TikTokPrivacyLevel | null
    isAutoMusicEnabled?: boolean | null
    instagramLocationId?: string | null
    instagramFacebookPageId?: string | null
}

export interface CreatePostsRequest {
    postType: PostType
    postStatus: PostStatus
    posts: CreatePostTargetRequest[]
    postNow?: boolean
    scheduledTime?: Date | null
    mainCaption?: string | null
    coverTimestamp?: number | null
    copyDataUrls?: string[]
}
