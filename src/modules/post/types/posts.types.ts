import type { PostType, SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'

export enum PostStatus {
    DRAFT = 'DRAFT',
    PENDING = 'PENDING',
    POSTING = 'POSTING',
    DONE = 'DONE',
    FAILED = 'FAILED',
    PARTIALLY_DONE = 'PARTIALLY_DONE',
}

export enum ThreadsMediaType {
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    CAROUSEL = 'CAROUSEL',
}

export enum ThreadsPostStatus {
    FINISHED = 'FINISHED',
    IN_PROGRESS = 'IN_PROGRESS',
    PUBLISHED = 'PUBLISHED',
    ERROR = 'ERROR',
    EXPIRED = 'EXPIRED',
}

export enum InstagramMediaType {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    REELS = 'REELS',
    STORIES = 'STORIES',
}

export enum InstagramPostStatus {
    FINISHED = 'FINISHED',
    IN_PROGRESS = 'IN_PROGRESS',
    PUBLISHED = 'PUBLISHED',
    ERROR = 'ERROR',
    EXPIRED = 'EXPIRED',
}

export enum TikTokPrivacyLevel {
    PUBLIC = 'PUBLIC',
    FRIENDS = 'FRIENDS',
    PRIVATE = 'PRIVATE',
    SELF_ONLY = 'SELF_ONLY',
}

export enum TikTokMediaAssestSourceType {
    FILE_UPLOAD = 'FILE_UPLOAD',
    PULL_FROM_URL = 'PULL_FROM_URL',
}

export enum TikTokPostMode {
    DIRECT_POST = 'DIRECT_POST',
}

export interface PostTarget {
    postId: string
    socialAccountId: string
    platform: SocilaMediaPlatform
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

export interface PostTargetResponse {
    platform: SocilaMediaPlatform
    status?: PostStatus | null
    socialAccountId: string
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
    errorMessage?: string | null
}

export interface PostMediaAsset {
    mediaId?: string
    url: string
    type?: string | null
    order?: number | null
}

export interface CreatePostResponse {
    postId: string
    type: PostType
    status: PostStatus
    scheduledAtLocal?: string | null
    timezone?: string | null
    createdAt: Date
    mainCaption?: string | null
    coverTimestamp?: number | null
    coverImageUrl?: string | null
    targets: PostTargetResponse[]
    media?: { url: string; type: string }
}

export type IPost = CreatePostResponse

export interface PostFilters {
    page?: number
    limit?: number
    status?: PostStatus
    platform?: SocilaMediaPlatform
    fromDate?: Date
    toDate?: Date
    workspaceId?: string
}

export interface PostListItem {
    postId: string
    type: PostType
    status: PostStatus
    scheduledAtLocal?: string | null
    timezone?: string | null
    createdAt: Date
    mainCaption?: string | null
    coverTimestamp?: number | null
    coverImageUrl?: string | null
    targets: PostTargetResponse[]
    media: PostMediaAsset[]
}

export interface PostsListResponse {
    posts: PostListItem[]
    total: number
    page: number
    limit: number
    hasMore: boolean
}

export interface PostsByDateResponse {
    posts: PostListItem[]
}
