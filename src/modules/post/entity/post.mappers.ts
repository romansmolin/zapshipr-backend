import type { PostTargetRow } from './post.schema'
import type { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { TikTokPrivacyLevel } from '@/modules/post/types/posts.types'
import type { PostMediaAsset, PostStatus, PostTargetResponse } from '@/modules/post/types/posts.types'

const normalizeStringArray = (value: unknown): string[] | null => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string')
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) {
                return parsed.filter((item): item is string => typeof item === 'string')
            }
        } catch {
            return [value]
        }
    }

    return null
}

const normalizeThreadsReplies = (value: unknown): string[] | null => {
    const normalized = normalizeStringArray(value)
    return normalized ?? []
}

const normalizeTikTokPrivacyLevel = (value: unknown): TikTokPrivacyLevel | null => {
    if (typeof value === 'string' && Object.values(TikTokPrivacyLevel).includes(value as TikTokPrivacyLevel)) {
        return value as TikTokPrivacyLevel
    }
    return null
}

export const toPostTargetResponse = (row: PostTargetRow): PostTargetResponse => {
    return {
        platform: row.platform as SocilaMediaPlatform,
        status: row.status as PostStatus,
        socialAccountId: row.socialAccountId,
        title: row.title ?? null,
        text: row.text ?? null,
        pinterestBoardId: row.pinterestBoardId ?? null,
        tags: normalizeStringArray(row.tags),
        links: normalizeStringArray(row.links),
        isAutoMusicEnabled: row.isAutoMusicEnabled ?? null,
        instagramLocationId: row.instagramLocationId ?? null,
        instagramFacebookPageId: row.instagramFacebookPageId ?? null,
        threadsReplies: normalizeThreadsReplies(row.threadsReplies),
        tikTokPostPrivacyLevel: normalizeTikTokPrivacyLevel(row.tikTokPostPrivacyLevel),
        errorMessage: row.errorMessage ?? null,
    }
}

export const toPostMediaAsset = (params: {
    mediaId: string
    url: string
    type: string | null
    order: number | null
}): PostMediaAsset => {
    return {
        mediaId: params.mediaId,
        url: params.url,
        type: params.type,
        order: params.order,
    }
}
