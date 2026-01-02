"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const format_captions_with_tags_1 = require("../../utils/format-captions-with-tags");
const posts_types_1 = require("@/modules/post/types/posts.types");
const axios_1 = __importDefault(require("axios"));
class InstagramContentPublisherService {
    constructor(logger, accountRepository, postRepository, videoProcessor, socialMediaErrorHandler, mediaUploader, httpClient) {
        this.IG_POLL_INTERVAL_MS = 5000;
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.videoProcessor = videoProcessor;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
        this.mediaUploader = mediaUploader;
        this.httpClient = httpClient;
    }
    async waitForInstagramContainerReady(containerId, accessToken) {
        let pollCount = 0;
        const maxPolls = 60;
        while (true) {
            pollCount++;
            try {
                const response = await this.httpClient.get(`https://graph.instagram.com/v23.0/${containerId}`, {
                    params: {
                        access_token: accessToken,
                        fields: 'status_code,id',
                    },
                });
                const status = response.status_code;
                switch (status) {
                    case posts_types_1.InstagramPostStatus.IN_PROGRESS:
                        if (pollCount >= maxPolls) {
                            throw new base_error_1.BaseAppError(`Instagram container ${containerId} still in progress after ${maxPolls} polls (${(maxPolls * this.IG_POLL_INTERVAL_MS) / 1000} seconds)`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                        }
                        await new Promise((resolve) => setTimeout(resolve, this.IG_POLL_INTERVAL_MS));
                        continue;
                    case posts_types_1.InstagramPostStatus.FINISHED:
                        this.logger.info('Instagram container finished processing', {
                            operation: 'waitForInstagramContainerReady',
                            containerId,
                            pollCount,
                        });
                        return status;
                    case posts_types_1.InstagramPostStatus.PUBLISHED:
                        this.logger.info('Instagram container already published', {
                            operation: 'waitForInstagramContainerReady',
                            containerId,
                            pollCount,
                        });
                        return status;
                    case posts_types_1.InstagramPostStatus.ERROR:
                        this.logger.error('Instagram container failed with ERROR status', {
                            operation: 'waitForInstagramContainerReady',
                            containerId,
                            processingTimeSeconds: pollCount * 5,
                        });
                        throw new base_error_1.BaseAppError(`Instagram container ${containerId} failed (ERROR)`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                    case posts_types_1.InstagramPostStatus.EXPIRED:
                        this.logger.error('Instagram container expired', {
                            operation: 'waitForInstagramContainerReady',
                            containerId,
                            pollCount,
                            status,
                        });
                        throw new base_error_1.BaseAppError(`Instagram container ${containerId} expired before publish`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                    default:
                        this.logger.error('Unknown Instagram container status', {
                            operation: 'waitForInstagramContainerReady',
                            containerId,
                            pollCount,
                            status,
                            responseData: response,
                        });
                        throw new base_error_1.BaseAppError(`Unknown Instagram container status "${status}" for container ${containerId}`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                }
            }
            catch (error) {
                this.logger.error('Error polling Instagram container status', {
                    operation: 'waitForInstagramContainerReady',
                    containerId,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
                throw error;
            }
        }
    }
    async resolveInstagramLocationIdFromFacebookPage(userId, facebookPageReference) {
        if (!facebookPageReference) {
            return undefined;
        }
        let resolvedPageId = facebookPageReference;
        let facebookAccount = await this.accountRepository.findByTenantPlatformAndPage(userId, 'facebook', facebookPageReference);
        if (!facebookAccount) {
            const accountById = await this.accountRepository.getAccountById(userId, facebookPageReference);
            if (accountById && accountById.platform === 'facebook') {
                facebookAccount = accountById;
                resolvedPageId = accountById.pageId;
            }
        }
        if (!facebookAccount) {
            throw new base_error_1.BaseAppError('Selected Facebook Page must be connected before enabling Instagram location tagging', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        try {
            const response = await this.httpClient.get(`https://graph.facebook.com/v19.0/${resolvedPageId}`, {
                params: {
                    fields: 'location',
                    access_token: facebookAccount.accessToken,
                },
            });
            if (!response?.location) {
                throw new base_error_1.BaseAppError('Selected Facebook Page does not contain location information required by Instagram', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            return resolvedPageId;
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            this.logger.error('Failed to fetch location data from Facebook Page', {
                operation: 'resolveInstagramLocationIdFromFacebookPage',
                userId,
                facebookPageReference,
                resolvedPageId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
                response: axios_1.default.isAxiosError(error) ? error.response?.data : undefined,
                status: axios_1.default.isAxiosError(error) ? error.response?.status : undefined,
            });
            throw new base_error_1.BaseAppError('Unable to retrieve Facebook Page location information', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
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
    async sendPostToInstagram(postTarget, userId, postId, mainCaption, post) {
        const temporaryUploads = [];
        try {
            const { accessToken, pageId } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const mediaAssets = await this.postRepository.getPostMediaAssets(postId);
            const normalizedLegacyLocationId = postTarget.instagramLocationId?.trim();
            const legacyLocationId = normalizedLegacyLocationId && normalizedLegacyLocationId.length > 0
                ? normalizedLegacyLocationId
                : undefined;
            const normalizedFacebookPageId = postTarget.instagramFacebookPageId?.trim();
            const facebookPageId = normalizedFacebookPageId && normalizedFacebookPageId.length > 0
                ? normalizedFacebookPageId
                : undefined;
            if (mediaAssets.length === 0) {
                throw new base_error_1.BaseAppError('No media assets found for Instagram post', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const hasVideo = mediaAssets.some((asset) => asset.type?.startsWith('video'));
            const hasImage = mediaAssets.some((asset) => asset.type?.startsWith('image'));
            if (hasVideo && hasImage) {
                throw new base_error_1.BaseAppError('Instagram does not support mixed media types (video + images)', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            if (hasVideo && mediaAssets.length > 1) {
                throw new base_error_1.BaseAppError('Instagram only supports one video per post', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            if ((facebookPageId || legacyLocationId) && mediaAssets.length > 1) {
                throw new base_error_1.BaseAppError('Instagram location tagging is not supported for carousel posts', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const resolvedLocationId = await this.resolveInstagramLocationIdFromFacebookPage(userId, facebookPageId);
            const locationId = resolvedLocationId ?? legacyLocationId;
            let creationId;
            if (mediaAssets.length === 1) {
                const mediaAsset = mediaAssets[0];
                const mediaType = mediaAsset.type?.startsWith('image')
                    ? posts_types_1.InstagramMediaType.IMAGE
                    : mediaAsset.type?.startsWith('video')
                        ? posts_types_1.InstagramMediaType.REELS
                        : null;
                if (!mediaType) {
                    throw new base_error_1.BaseAppError('Unsupported media type for Instagram', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                let processedVideoUrl = mediaAsset.url;
                if (mediaType === posts_types_1.InstagramMediaType.REELS) {
                    try {
                        const videoResponse = await this.httpClient.get(mediaAsset.url, {
                            responseType: 'arraybuffer',
                        });
                        const videoBuffer = Buffer.isBuffer(videoResponse)
                            ? videoResponse
                            : Buffer.from(videoResponse);
                        const processedVideoBuffer = await this.videoProcessor.processVideoForPlatform(videoBuffer, 'instagram');
                        const uploadedVideoUrl = await this.mediaUploader.upload({
                            key: `${userId}/processed/instagram/${postId}-${Date.now()}.mp4`,
                            body: processedVideoBuffer,
                            contentType: 'video/mp4',
                        });
                        temporaryUploads.push(uploadedVideoUrl);
                        this.logger.info('Instagram video processed successfully', {
                            operation: 'sendPostToInstagram',
                            originalSize: videoBuffer.length,
                            processedSize: processedVideoBuffer.length,
                        });
                        processedVideoUrl = uploadedVideoUrl;
                    }
                    catch (error) {
                        this.logger.warn('Failed to process video for Instagram, using original', {
                            operation: 'sendPostToInstagram',
                            error: {
                                name: error instanceof Error ? error.name : 'UnknownError',
                                code: error instanceof Error ? error.message : 'Unknown error',
                                stack: error instanceof Error ? error.stack : undefined,
                            },
                            videoUrl: mediaAsset.url,
                        });
                    }
                }
                const formattedCaption = (0, format_captions_with_tags_1.formatCaptionWithTags)(postTarget.text || mainCaption, postTarget.tags, 'instagram');
                const requestParams = {
                    access_token: accessToken,
                    caption: formattedCaption,
                    ...(mediaType === posts_types_1.InstagramMediaType.REELS ? { media_type: mediaType } : {}),
                    ...(mediaType === posts_types_1.InstagramMediaType.IMAGE ? { image_url: mediaAsset.url } : {}),
                    ...(mediaType === posts_types_1.InstagramMediaType.REELS ? { video_url: processedVideoUrl } : {}),
                    ...(mediaType === posts_types_1.InstagramMediaType.REELS && post?.coverImageUrl
                        ? { cover_url: post.coverImageUrl }
                        : {}),
                    ...(mediaType === posts_types_1.InstagramMediaType.REELS && typeof post?.coverTimestamp === 'number'
                        ? { thumb_offset: post.coverTimestamp * 1000 }
                        : {}),
                    ...(locationId ? { location_id: locationId } : {}),
                };
                try {
                    const headResponse = await axios_1.default.head(processedVideoUrl, { timeout: 10000 });
                    const contentLength = parseInt(headResponse.headers['content-length'] || '0');
                    const fileSizeMB = contentLength / (1024 * 1024);
                    this.logger.info('Processed video URL validation successful', {
                        operation: 'sendPostToInstagram',
                        fileSizeMB: fileSizeMB.toFixed(2),
                        contentType: headResponse.headers['content-type'],
                    });
                }
                catch (validationError) {
                    this.logger.warn('Processed video URL validation failed', {
                        operation: 'sendPostToInstagram',
                        error: {
                            name: validationError instanceof Error ? validationError.name : 'UnknownError',
                            code: validationError instanceof Error ? validationError.message : 'Unknown error',
                            stack: validationError instanceof Error ? validationError.stack : undefined,
                        },
                    });
                }
                this.logger.info('Creating Instagram media container', {
                    operation: 'sendPostToInstagram',
                    mediaType,
                });
                let response;
                try {
                    response = await this.httpClient.post(`https://graph.instagram.com/v23.0/${pageId}/media`, null, {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${accessToken}`,
                        },
                        params: requestParams,
                    });
                }
                catch (error) {
                    this.logger.error('Failed to create Instagram media container', {
                        operation: 'sendPostToInstagram',
                        pageId,
                        requestParams,
                        error: {
                            name: error instanceof Error ? error.name : 'UnknownError',
                            code: error instanceof Error ? error.message : 'Unknown error',
                            stack: error instanceof Error ? error.stack : undefined,
                        },
                        response: axios_1.default.isAxiosError(error) ? error.response?.data : undefined,
                        status: axios_1.default.isAxiosError(error) ? error.response?.status : undefined,
                        statusText: axios_1.default.isAxiosError(error) ? error.response?.statusText : undefined,
                        fullErrorResponse: axios_1.default.isAxiosError(error)
                            ? error.response?.data?.error
                            : undefined,
                    });
                    throw error;
                }
                creationId = response.id;
                this.logger.info('Instagram media container created successfully', {
                    operation: 'sendPostToInstagram',
                    creationId,
                });
            }
            else {
                if (mediaAssets.length > 10) {
                    throw new base_error_1.BaseAppError('Instagram carousel supports maximum 10 images', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const mediaContainerIds = [];
                for (const mediaAsset of mediaAssets) {
                    const response = await this.httpClient.post(`https://graph.instagram.com/v23.0/${pageId}/media`, null, {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${accessToken}`,
                        },
                        params: {
                            access_token: accessToken,
                            image_url: mediaAsset.url,
                            is_carousel_item: true,
                        },
                    });
                    mediaContainerIds.push(response.id);
                }
                await Promise.all(mediaContainerIds.map((containerId) => this.waitForInstagramContainerReady(containerId, accessToken)));
                const carouselResponse = await this.httpClient.post(`https://graph.instagram.com/v23.0/${pageId}/media`, null, {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: {
                        access_token: accessToken,
                        caption: (0, format_captions_with_tags_1.formatCaptionWithTags)(postTarget.text || mainCaption, postTarget.tags, 'instagram'),
                        media_type: 'CAROUSEL',
                        children: mediaContainerIds.join(','),
                    },
                });
                creationId = carouselResponse.id;
            }
            this.logger.info('Waiting for Instagram container to be ready', {
                operation: 'sendPostToInstagram',
                creationId,
            });
            await this.waitForInstagramContainerReady(creationId, accessToken);
            this.logger.info('Instagram container is ready, publishing post', {
                operation: 'sendPostToInstagram',
                creationId,
                pageId,
            });
            const publishParams = {
                creation_id: creationId,
            };
            this.logger.info('Publishing Instagram post', {
                operation: 'sendPostToInstagram',
                pageId,
                publishParams,
            });
            let postRes;
            try {
                postRes = await this.httpClient.post(`https://graph.instagram.com/v23.0/${pageId}/media_publish`, null, {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: publishParams,
                });
            }
            catch (error) {
                this.logger.error('Failed to publish Instagram post', {
                    operation: 'sendPostToInstagram',
                    pageId,
                    publishParams,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                    response: axios_1.default.isAxiosError(error) ? error.response?.data : undefined,
                    status: axios_1.default.isAxiosError(error) ? error.response?.status : undefined,
                    statusText: axios_1.default.isAxiosError(error) ? error.response?.statusText : undefined,
                });
                throw error;
            }
            this.logger.info('Instagram publish API response', {
                operation: 'sendPostToInstagram',
                responseData: postRes,
            });
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('Instagram post published successfully', {
                operation: 'sendPostToInstagram',
                userId,
                postId,
                instagramPostId: postRes.id,
                mediaCount: mediaAssets.length,
                mediaType: mediaAssets.length > 1 ? 'carousel' : hasVideo ? 'video' : 'image',
            });
            return await this.postRepository.getPostDetails(postId, userId);
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'instagram', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
        finally {
            await this.cleanupTemporaryUploads(temporaryUploads);
        }
    }
}
exports.InstagramContentPublisherService = InstagramContentPublisherService;
