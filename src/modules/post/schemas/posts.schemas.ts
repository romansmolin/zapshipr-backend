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
    mediaIndices?: number[] | null
}

export interface MediaTransformCrop {
    x: number
    y: number
    scale: number
}

export interface MediaTransformSource {
    width: number
    height: number
}

export interface MediaTransformRequest {
    mediaIndex: number
    platform?: PostPlatform
    ratio: 'original' | string
    crop: MediaTransformCrop
    source: MediaTransformSource
    version: 1
}

export interface UploadedMediaRequest {
    key: string
    type: string
    originalName?: string | null
    size?: number | null
    url?: string | null
}

export interface PresignUploadFileRequest {
    mimeType: string
    size: number
    extension?: string | null
    checksum?: string | null
}

export interface PresignedUploadResponseItem {
    uploadUrl: string
    key: string
    expiresAt: string
    headers?: Record<string, string>
}

export interface CreatePostsRequest {
    postType: PostType
    postStatus: PostStatus
    posts: CreatePostTargetRequest[]
    postNow?: boolean
    scheduledAtLocal?: string | null
    timezone?: string | null
    mainCaption?: string | null
    coverTimestamp?: number | null
    copyDataUrls?: string[] | null
    mediaTransforms?: MediaTransformRequest[] | null
    uploadedMedia?: UploadedMediaRequest[] | null
}
