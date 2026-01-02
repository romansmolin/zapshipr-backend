"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPostMediaAsset = exports.toPostTargetResponse = void 0;
const posts_types_1 = require("@/modules/post/types/posts.types");
const normalizeStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.filter((item) => typeof item === 'string');
            }
        }
        catch {
            return [value];
        }
    }
    return null;
};
const normalizeThreadsReplies = (value) => {
    const normalized = normalizeStringArray(value);
    return normalized ?? [];
};
const normalizeTikTokPrivacyLevel = (value) => {
    if (typeof value === 'string' && Object.values(posts_types_1.TikTokPrivacyLevel).includes(value)) {
        return value;
    }
    return null;
};
const toPostTargetResponse = (row) => {
    return {
        platform: row.platform,
        status: row.status,
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
    };
};
exports.toPostTargetResponse = toPostTargetResponse;
const toPostMediaAsset = (params) => {
    return {
        mediaId: params.mediaId,
        url: params.url,
        type: params.type,
        order: params.order,
    };
};
exports.toPostMediaAsset = toPostMediaAsset;
