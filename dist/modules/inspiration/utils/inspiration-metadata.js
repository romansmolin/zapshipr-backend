"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInspirationMetadataSource = void 0;
const isYouTubeUrl = (url) => {
    return /youtube\.com\/watch/i.test(url) || /youtu\.be\//i.test(url) || /youtube\.com\/embed/i.test(url);
};
const isNotionUrl = (url) => {
    return /notion\.so/i.test(url) || /notion\.site/i.test(url);
};
const isTikTokUrl = (url) => {
    return /tiktok\.com/i.test(url);
};
const extractTikTokMediaId = (url) => {
    const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
    if (match)
        return match[1];
    return null;
};
const extractYouTubeVideoId = (url) => {
    const youtubePatterns = [
        /youtube\.com\/watch\?v=([^&]+)/i,
        /youtu\.be\/([^?]+)/i,
        /youtube\.com\/embed\/([^?]+)/i,
    ];
    for (const pattern of youtubePatterns) {
        const match = url.match(pattern);
        if (match)
            return match[1];
    }
    return null;
};
const buildInspirationMetadataSource = (type, content) => {
    if (type === 'document')
        return { source: 'docs' };
    if (type === 'link' && content) {
        if (isYouTubeUrl(content)) {
            const youTubeVideoId = extractYouTubeVideoId(content) ?? undefined;
            return youTubeVideoId ? { source: 'youtube', youTubeVideoId } : { source: 'youtube' };
        }
        if (isTikTokUrl(content)) {
            const tikTokMediaId = extractTikTokMediaId(content) ?? undefined;
            return tikTokMediaId ? { source: 'tiktok', tikTokMediaId } : { source: 'tiktok' };
        }
        if (isNotionUrl(content))
            return { source: 'notion' };
        return { source: 'external' };
    }
    return { source: 'external' };
};
exports.buildInspirationMetadataSource = buildInspirationMetadataSource;
