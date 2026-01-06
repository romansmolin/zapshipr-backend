"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
const format_captions_with_tags_1 = require("../../utils/format-captions-with-tags");
const ffmpeg = __importStar(require("fluent-ffmpeg"));
const path = __importStar(require("path"));
const promises_1 = require("fs/promises");
class TikTokContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler, videoProcessor, imageProcessor, mediaUploader) {
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
        this.videoProcessor = videoProcessor;
        this.imageProcessor = imageProcessor;
        this.mediaUploader = mediaUploader;
    }
    async downloadImage(url) {
        const response = await this.httpClient.get(url, {
            responseType: 'arraybuffer',
            timeoutMs: 30000,
        });
        return Buffer.isBuffer(response) ? response : Buffer.from(response);
    }
    async getOrCreateResizedImage(originalUrl, userId, postId, assetIndex) {
        const imageBuffer = await this.downloadImage(originalUrl);
        const validation = await this.imageProcessor.validateImageForPlatform(imageBuffer, 'tiktok');
        if (validation.valid) {
            return { url: originalUrl, isTemporary: false };
        }
        const resizedKey = `${userId}/resized/tiktok/${postId}-${assetIndex}-${Date.now()}.jpg`;
        const processedBuffer = await this.imageProcessor.processImageForPlatform(imageBuffer, 'tiktok', originalUrl);
        const resizedUrl = await this.mediaUploader.upload({
            key: resizedKey,
            body: processedBuffer,
            contentType: 'image/jpeg',
        });
        this.logger.info('Created resized image for TikTok', {
            operation: 'getOrCreateResizedImage',
            userId,
            postId,
            assetIndex,
            originalUrl,
            resizedUrl,
            originalSize: imageBuffer.length,
            resizedSize: processedBuffer.length,
        });
        return { url: resizedUrl, isTemporary: true };
    }
    async cleanupTemporaryUploads(urls) {
        for (const url of urls) {
            try {
                await this.mediaUploader.delete(url);
                this.logger.debug('Cleaned up temporary media asset from S3', {
                    operation: 'cleanupTemporaryUploads',
                    url,
                });
            }
            catch (error) {
                this.logger.warn('Failed to cleanup temporary media asset from S3', {
                    operation: 'cleanupTemporaryUploads',
                    url,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
            }
        }
    }
    async getPostingCreatorInfo(accessToken, userId, postId) {
        const { TIKTOK_API_URL, TIKTOK_API_VERSION } = process.env;
        if (!TIKTOK_API_URL || !TIKTOK_API_VERSION) {
            throw new base_error_1.BaseAppError('Missing TikTok API configuration', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        try {
            const response = await this.httpClient.post(`${TIKTOK_API_URL}/${TIKTOK_API_VERSION}/post/publish/creator_info/query/`, {}, // TikTok expects an empty JSON body; avoid sending headers as body
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const infoPayload = response?.data ?? response?.creator_info ?? response ?? response?.data;
            const canPostSignal = [
                infoPayload?.can_post,
                infoPayload?.can_post_more,
                infoPayload?.can_post_now,
            ].find((flag) => typeof flag === 'boolean');
            const canPost = typeof canPostSignal === 'boolean' ? canPostSignal : null;
            const rawDuration = infoPayload?.max_video_post_duration_sec;
            const maxVideoPostDurationSec = typeof rawDuration === 'number'
                ? rawDuration
                : typeof rawDuration === 'string' && rawDuration
                    ? Number(rawDuration)
                    : null;
            const privacyLevelOptions = Array.isArray(infoPayload?.privacy_level_options)
                ? infoPayload.privacy_level_options
                : null;
            const normalizedMaxDuration = typeof maxVideoPostDurationSec === 'number' && Number.isFinite(maxVideoPostDurationSec)
                ? maxVideoPostDurationSec
                : null;
            return {
                canPost,
                maxVideoPostDurationSec: normalizedMaxDuration,
                privacyLevelOptions,
            };
        }
        catch (error) {
            const responseData = error && typeof error === 'object' && 'response' in error && error.response?.data;
            this.logger.error('Error retrieving posting creator info from TikTok', {
                operation: 'getPostingCreatorInfo',
                userId,
                postId,
                responseData,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error occurred',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw new base_error_1.BaseAppError('Failed to retrieve TikTok creator info', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    resolvePrivacyLevel(privacyOptions, requestedPrivacy) {
        const validOptions = (privacyOptions || [])
            .map((option) => option?.toUpperCase())
            .filter((option) => Object.values(posts_types_1.TikTokPrivacyLevel).includes(option));
        if (requestedPrivacy) {
            if (validOptions.length === 0 || validOptions.includes(requestedPrivacy)) {
                return requestedPrivacy;
            }
            this.logger.warn('Requested TikTok privacy level not allowed; falling back to available options', {
                operation: 'resolvePrivacyLevel',
                requestedPrivacy,
                availableOptions: validOptions,
            });
        }
        if (validOptions.includes(posts_types_1.TikTokPrivacyLevel.SELF_ONLY)) {
            return posts_types_1.TikTokPrivacyLevel.SELF_ONLY;
        }
        return validOptions[0] ?? posts_types_1.TikTokPrivacyLevel.SELF_ONLY;
    }
    async getVideoDurationSeconds(videoBuffer, userId, postId) {
        const tempDir = path.join(process.cwd(), 'temp', 'tiktok-video-duration', `${userId}-${postId}-${Date.now()}`);
        const videoPath = path.join(tempDir, 'video.mp4');
        await (0, promises_1.mkdir)(tempDir, { recursive: true });
        try {
            await (0, promises_1.writeFile)(videoPath, videoBuffer);
            const duration = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(videoPath, (err, metadata) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(metadata.format.duration || 0);
                });
            });
            return duration;
        }
        catch (error) {
            this.logger.error('Failed to measure TikTok video duration', {
                operation: 'getVideoDurationSeconds',
                userId,
                postId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error occurred',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw new base_error_1.BaseAppError('Unable to verify TikTok video duration. Please try again later.', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        finally {
            try {
                await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
            }
            catch (cleanupError) {
                this.logger.warn('Failed to cleanup temporary TikTok duration file', {
                    operation: 'getVideoDurationSeconds',
                    userId,
                    postId,
                    error: {
                        name: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
                        code: cleanupError instanceof Error ? cleanupError.message : 'Unknown error occurred',
                        stack: cleanupError instanceof Error ? cleanupError.stack : undefined,
                    },
                });
            }
        }
    }
    async sendPostToTikTok(postTarget, userId, postId, mainCaption, post) {
        try {
            const { TIKTOK_API_URL, TIKTOK_API_VERSION } = process.env;
            if (!TIKTOK_API_URL || !TIKTOK_API_VERSION) {
                throw new base_error_1.BaseAppError('Lack of requiring environment variables for TiktTok API', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const mediaAssets = await this.postRepository.getPostMediaAssets(postId);
            if (mediaAssets.length === 0) {
                throw new base_error_1.BaseAppError('TikTok posts require video or image content', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const { accessToken, maxVideoPostDurationSec: storedMaxVideoPostDurationSec, privacyLevelOptions: storedPrivacyLevelOptions, } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const creatorInfo = await this.getPostingCreatorInfo(accessToken, userId, postId);
            if (creatorInfo.canPost === false) {
                throw new base_error_1.BaseAppError('TikTok account cannot publish right now. Please try again later.', error_codes_const_1.ErrorCode.RATE_LIMIT_EXCEEDED, 429);
            }
            const maxAllowedVideoDurationSec = creatorInfo.maxVideoPostDurationSec ?? storedMaxVideoPostDurationSec ?? null;
            const privacyLevel = this.resolvePrivacyLevel(creatorInfo.privacyLevelOptions ?? storedPrivacyLevelOptions ?? null, postTarget.tikTokPostPrivacyLevel ?? null);
            const description = (0, format_captions_with_tags_1.formatCaptionWithTags)(postTarget.text || mainCaption, postTarget.tags, 'tiktok') || '';
            const hasVideo = mediaAssets.some((asset) => asset.type?.startsWith('video'));
            const hasImage = mediaAssets.some((asset) => asset.type?.startsWith('image'));
            if (hasVideo && hasImage) {
                throw new base_error_1.BaseAppError('TikTok does not support mixed media types (video + images)', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            if (hasVideo && mediaAssets.length > 1) {
                throw new base_error_1.BaseAppError('TikTok only supports one video per post', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            let publishId;
            if (hasVideo) {
                const mediaAsset = mediaAssets[0];
                let mediaBuffer;
                if (post?.coverImageUrl) {
                    try {
                        this.logger.info('Processing video with cover image for TikTok', {
                            operation: 'sendPostToTikTok',
                            userId,
                            postId,
                            coverImageUrl: post.coverImageUrl,
                        });
                        const mediaResponse = await this.httpClient.get(mediaAsset.url, {
                            responseType: 'arraybuffer',
                        });
                        const originalVideoBuffer = Buffer.isBuffer(mediaResponse)
                            ? mediaResponse
                            : Buffer.from(mediaResponse);
                        const processedVideoBuffer = await this.videoProcessor.processVideoWithCover(originalVideoBuffer, post.coverImageUrl);
                        mediaBuffer = processedVideoBuffer;
                    }
                    catch (error) {
                        this.logger.error('Failed to process video with cover image for TikTok, using original', {
                            operation: 'sendPostToTikTok',
                            userId,
                            postId,
                            error: {
                                name: error instanceof Error ? error.name : 'UnknownError',
                                code: error instanceof Error ? error.message : 'Unknown error occurred',
                                stack: error instanceof Error ? error.stack : undefined,
                            },
                        });
                        const mediaResponse = await this.httpClient.get(mediaAsset.url, {
                            responseType: 'arraybuffer',
                        });
                        mediaBuffer = Buffer.isBuffer(mediaResponse) ? mediaResponse : Buffer.from(mediaResponse);
                    }
                }
                else {
                    const mediaResponse = await this.httpClient.get(mediaAsset.url, {
                        responseType: 'arraybuffer',
                    });
                    mediaBuffer = Buffer.isBuffer(mediaResponse) ? mediaResponse : Buffer.from(mediaResponse);
                }
                if (maxAllowedVideoDurationSec) {
                    const videoDurationSeconds = await this.getVideoDurationSeconds(mediaBuffer, userId, postId);
                    if (videoDurationSeconds > maxAllowedVideoDurationSec) {
                        throw new base_error_1.BaseAppError(`TikTok video duration exceeds the allowed limit of ${maxAllowedVideoDurationSec} seconds. Please shorten your video and try again.`, error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                    }
                }
                const mediaSize = mediaBuffer.length;
                this.logger.debug('PRIVACY LEVEL: ', { privacy_level: privacyLevel });
                const initResponse = await this.httpClient.post(`${TIKTOK_API_URL}/${TIKTOK_API_VERSION}/post/publish/video/init/`, {
                    post_info: {
                        privacy_level: privacyLevel,
                        title: postTarget.title,
                        brand_content_toggle: false,
                        brand_organic_toggle: false,
                        ...(post?.coverImageUrl && {
                            video_cover_timestamp_ms: 1,
                        }),
                        ...(post?.coverTimestamp &&
                            !post?.coverImageUrl && {
                            video_cover_timestamp_ms: Math.floor(Number(post.coverTimestamp) * 1000),
                        }),
                    },
                    source_info: {
                        source: posts_types_1.TikTokMediaAssestSourceType.FILE_UPLOAD,
                        video_size: mediaSize,
                        chunk_size: mediaSize,
                        total_chunk_count: 1,
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                publishId = initResponse.data.publish_id;
                const uploadUrl = initResponse.data.upload_url;
                const contentType = mediaAsset.type ?? 'application/octet-stream';
                await this.httpClient.put(uploadUrl, mediaBuffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': mediaSize.toString(),
                        'Content-Range': `bytes 0-${mediaSize - 1}/${mediaSize}`,
                    },
                });
            }
            else {
                if (mediaAssets.length > 35) {
                    throw new base_error_1.BaseAppError('TikTok supports maximum 35 images in a slideshow', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const hasVideoInImages = mediaAssets.some((asset) => asset.type?.startsWith('video'));
                if (hasVideoInImages) {
                    throw new base_error_1.BaseAppError('TikTok slideshow only supports images, not videos', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const photoUrls = [];
                const temporaryUploads = [];
                try {
                    for (const [index, asset] of mediaAssets.entries()) {
                        const { url: resizedUrl, isTemporary } = await this.getOrCreateResizedImage(asset.url, userId, postId, index);
                        if (isTemporary) {
                            temporaryUploads.push(resizedUrl);
                        }
                        this.logger.info('Using image for TikTok', {
                            operation: 'sendPostToTikTok',
                            userId,
                            postId,
                            assetIndex: index + 1,
                            originalUrl: asset.url,
                            resizedUrl,
                        });
                        photoUrls.push(resizedUrl);
                    }
                    const initResponse = await this.httpClient.post('https://open.tiktokapis.com/v2/post/publish/content/init/', {
                        media_type: 'PHOTO',
                        post_mode: posts_types_1.TikTokPostMode.DIRECT_POST,
                        post_info: {
                            title: postTarget.title,
                            description,
                            auto_add_music: postTarget.isAutoMusicEnabled,
                            privacy_level: privacyLevel,
                            brand_content_toggle: false,
                            brand_organic_toggle: false,
                        },
                        source_info: {
                            source: posts_types_1.TikTokMediaAssestSourceType.PULL_FROM_URL,
                            photo_cover_index: 0,
                            photo_images: photoUrls,
                        },
                    }, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                    });
                    publishId = initResponse.data.publish_id;
                }
                finally {
                    await this.cleanupTemporaryUploads(temporaryUploads);
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 3000));
            const statusResponse = await this.httpClient.post(`${TIKTOK_API_URL}/${TIKTOK_API_VERSION}/post/publish/status/fetch/`, {
                publish_id: publishId,
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const uploadStatus = statusResponse.data?.status;
            if (uploadStatus === 'FAILED') {
                const failureDetail = statusResponse.data?.fail_reason || 'Unknown failure reason';
                this.logger.error('TikTok media upload failed', {
                    operation: 'sendPostToTikTok',
                    userId,
                    postId,
                    publishId,
                    mediaType: hasVideo ? 'video' : 'photo',
                    mediaCount: mediaAssets.length,
                    status: uploadStatus,
                    failureReason: failureDetail,
                });
                await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.FAILED, failureDetail);
                throw new base_error_1.BaseAppError(`TikTok ${hasVideo ? 'video' : 'photo'} upload failed: ${failureDetail}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('TikTok media upload initiated successfully', {
                operation: 'sendPostToTikTok',
                userId,
                postId,
                publishId,
                mediaType: hasVideo ? 'video' : 'photo',
                mediaCount: mediaAssets.length,
                status: uploadStatus,
            });
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'tiktok', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
}
exports.TikTokContentPublisherService = TikTokContentPublisherService;
