"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueskyContentPublisherService = void 0;
const posts_types_1 = require("@/modules/post/types/posts.types");
const format_captions_with_tags_1 = require("../../utils/format-captions-with-tags");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
class BlueskyContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler) {
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
        this.baseApiUrl =
            (0, get_env_var_1.getEnvVar)('BLUESKY_API_BASE_URL') || (0, get_env_var_1.getEnvVar)('BLUESKY_OAUTH_BASE_URL') || 'https://bsky.social';
    }
    async buildBlueskyExternalEmbed(link, text, accessToken, apiBaseUrl, postId) {
        let normalizedLink;
        try {
            normalizedLink = new URL(link).toString();
        }
        catch (error) {
            this.logger.warn('Skipping Bluesky external embed due to invalid link', {
                operation: 'buildBlueskyExternalEmbed',
                link,
            });
            return undefined;
        }
        let html;
        try {
            const response = await this.httpClient.get(normalizedLink, {
                timeoutMs: 8000,
                responseType: 'text',
                headers: {
                    'User-Agent': 'EasyPostSocialMediaBot/1.0',
                },
                raw: {
                    maxContentLength: 2 * 1024 * 1024,
                },
            });
            html = typeof response === 'string' ? response : undefined;
        }
        catch (error) {
            this.logger.warn('Unable to fetch OG metadata for Bluesky link', {
                operation: 'buildBlueskyExternalEmbed',
                link: normalizedLink,
            });
        }
        const ogTitle = html ? this.extractBlueskyMetaContent(html, ['og:title', 'twitter:title']) : undefined;
        const ogDescription = html
            ? this.extractBlueskyMetaContent(html, ['og:description', 'twitter:description'])
            : undefined;
        const ogImage = html ? this.extractBlueskyMetaContent(html, ['og:image', 'twitter:image']) : undefined;
        const title = ogTitle?.trim() || normalizedLink;
        const descriptionSource = (ogDescription || text || normalizedLink).trim().slice(0, 300);
        const description = descriptionSource || normalizedLink;
        let thumbBlob;
        if (ogImage) {
            try {
                const resolvedImageUrl = new URL(ogImage, normalizedLink).toString();
                const imageResponse = await this.httpClient.get(resolvedImageUrl, {
                    responseType: 'arraybuffer',
                    timeoutMs: 8000,
                    raw: {
                        maxContentLength: 3 * 1024 * 1024,
                        transformResponse: [
                            (data, headers) => ({ data, headers }),
                        ],
                    },
                });
                const contentType = String(imageResponse.headers?.['content-type'] || imageResponse.headers?.['Content-Type'] || '' || '');
                if (!contentType.startsWith('image/')) {
                    throw new Error('OG image is not an image content type');
                }
                const uploadResponse = await this.httpClient.post(`${apiBaseUrl}/xrpc/com.atproto.repo.uploadBlob`, Buffer.from(imageResponse.data), {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': contentType || 'application/octet-stream',
                    },
                });
                const blob = uploadResponse?.blob;
                if (blob) {
                    thumbBlob = blob;
                }
                else {
                    this.logger.warn('Bluesky OG image upload missing blob data', {
                        operation: 'buildBlueskyExternalEmbed',
                        postId,
                    });
                }
            }
            catch (error) {
                this.logger.warn('Failed to attach OG image to Bluesky external embed', {
                    operation: 'buildBlueskyExternalEmbed',
                    link: normalizedLink,
                    postId,
                });
            }
        }
        const embed = {
            $type: 'app.bsky.embed.external',
            external: {
                uri: normalizedLink,
                title,
                description,
            },
        };
        if (thumbBlob) {
            ;
            embed.external.thumb = thumbBlob;
        }
        return embed;
    }
    extractBlueskyMetaContent(html, keys) {
        for (const key of keys) {
            const patterns = [
                new RegExp(`<meta[^>]+(?:property|name)=[\"']${key}[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>`, 'i'),
                new RegExp(`<meta[^>]+content=[\"']([^\"']+)[\"'][^>]*(?:property|name)=[\"']${key}[\"'][^>]*>`, 'i'),
            ];
            for (const pattern of patterns) {
                const match = pattern.exec(html);
                if (match?.[1]) {
                    return match[1];
                }
            }
        }
        return undefined;
    }
    buildBlueskyFacets(text) {
        const facets = [];
        if (!text)
            return facets;
        const addFacet = (matchText, startIndex, feature) => {
            const byteStart = Buffer.byteLength(text.slice(0, startIndex), 'utf8');
            const byteEnd = byteStart + Buffer.byteLength(matchText, 'utf8');
            facets.push({
                index: { byteStart, byteEnd },
                features: [feature],
            });
        };
        const hashtagPattern = /#[\p{L}\p{N}_]+/gu;
        let hashtagMatch;
        while ((hashtagMatch = hashtagPattern.exec(text)) !== null) {
            const hashtag = hashtagMatch[0].slice(1);
            if (hashtag.length === 0) {
                continue;
            }
            addFacet(hashtagMatch[0], hashtagMatch.index, {
                $type: 'app.bsky.richtext.facet#tag',
                tag: hashtag,
            });
        }
        const linkPattern = /https?:\/\/[^\s]+/gi;
        let linkMatch;
        while ((linkMatch = linkPattern.exec(text)) !== null) {
            const uri = linkMatch[0];
            try {
                const normalizedUri = new URL(uri).toString();
                addFacet(uri, linkMatch.index, {
                    $type: 'app.bsky.richtext.facet#link',
                    uri: normalizedUri,
                });
            }
            catch (error) {
                this.logger.warn('Skipping invalid Bluesky link facet', {
                    operation: 'buildBlueskyFacets',
                    uri,
                });
            }
        }
        return facets;
    }
    async sendPostToBluesky(postTarget, userId, postId, mainCaption) {
        try {
            const { accessToken: initialAccessToken, pageId } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const baseText = postTarget.text || mainCaption || '';
            const textWithTags = (0, format_captions_with_tags_1.formatCaptionWithTags)(baseText, postTarget.tags, 'bluesky');
            const links = postTarget.links?.filter((link) => link && link.trim().length > 0) || [];
            const initialText = textWithTags;
            const mediaAssets = await this.postRepository.getPostMediaAssets(postId);
            const linkEmbedCandidate = links[0];
            const maxLength = Number(process.env.BLUESKY_POST_MAX_LENGTH || 300);
            let lastCharLength = 0;
            const performPost = async (accessToken) => {
                let text = initialText;
                let embed;
                if (mediaAssets.length > 0) {
                    if (mediaAssets.length > 4) {
                        throw new base_error_1.BaseAppError('Bluesky supports up to 4 images per post', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                    }
                    const unsupportedAsset = mediaAssets.find((asset) => !asset.type?.startsWith('image'));
                    if (unsupportedAsset) {
                        throw new base_error_1.BaseAppError('Bluesky currently supports image attachments only', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                    }
                    const images = [];
                    for (let index = 0; index < mediaAssets.length; index++) {
                        const asset = mediaAssets[index];
                        const mediaResponse = await this.httpClient.get(asset.url, {
                            responseType: 'arraybuffer',
                        });
                        const mediaBuffer = Buffer.isBuffer(mediaResponse)
                            ? mediaResponse
                            : Buffer.from(mediaResponse);
                        const uploadResponse = await this.httpClient.post(`${this.baseApiUrl}/xrpc/com.atproto.repo.uploadBlob`, mediaBuffer, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': asset.type || 'application/octet-stream',
                            },
                        });
                        const blob = uploadResponse?.blob;
                        if (!blob) {
                            throw new base_error_1.BaseAppError('Bluesky did not return blob metadata for uploaded image', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                        }
                        images.push({
                            image: blob,
                            alt: `Image ${index + 1} for post ${postId}`,
                        });
                    }
                    embed = {
                        $type: 'app.bsky.embed.images',
                        images,
                    };
                }
                else if (linkEmbedCandidate) {
                    embed = await this.buildBlueskyExternalEmbed(linkEmbedCandidate, text, accessToken, this.baseApiUrl, postId);
                }
                if (!text && !embed && links.length > 0) {
                    text = links.join('\n');
                }
                const charLength = Array.from(text).length;
                if (charLength > maxLength) {
                    throw new base_error_1.BaseAppError(`Bluesky posts are limited to ${maxLength} characters including hashtags and links`, error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                lastCharLength = charLength;
                if (!text && !embed) {
                    throw new base_error_1.BaseAppError('Bluesky posts require text or image content', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const record = {
                    $type: 'app.bsky.feed.post',
                    text,
                    createdAt: new Date().toISOString(),
                };
                if (embed) {
                    record.embed = embed;
                }
                const facets = this.buildBlueskyFacets(text);
                if (facets.length > 0) {
                    record.facets = facets;
                }
                const payload = {
                    repo: pageId,
                    collection: 'app.bsky.feed.post',
                    record,
                };
                await this.httpClient.post(`${this.baseApiUrl}/xrpc/com.atproto.repo.createRecord`, payload, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
            };
            await performPost(initialAccessToken);
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('Bluesky post created successfully', {
                operation: 'sendPostToBluesky',
                userId,
                postId,
                socialAccountId: postTarget.socialAccountId,
                mediaCount: mediaAssets.length,
                charLength: lastCharLength,
            });
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'bluesky', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
}
exports.BlueskyContentPublisherService = BlueskyContentPublisherService;
