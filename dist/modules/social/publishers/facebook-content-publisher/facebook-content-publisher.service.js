"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
const format_captions_with_tags_1 = require("../../utils/format-captions-with-tags");
class FacebookContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler, imageProcessor, mediaUploader) {
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
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
        const validation = await this.imageProcessor.validateImageForPlatform(imageBuffer, 'facebook');
        if (validation.valid) {
            return { url: originalUrl, isTemporary: false };
        }
        const resizedKey = `${userId}/resized/facebook/${postId}-${assetIndex}-${Date.now()}.jpg`;
        const processedBuffer = await this.imageProcessor.processImageForPlatform(imageBuffer, 'facebook', originalUrl);
        const resizedUrl = await this.mediaUploader.upload({
            key: resizedKey,
            body: processedBuffer,
            contentType: 'image/jpeg',
        });
        this.logger.info('Created resized image for Facebook', {
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
    async sendPostToFacebook(postTarget, userId, postId, mainCaption) {
        try {
            const { accessToken, pageId } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const mediaAssets = await this.postRepository.getPostMediaAssets(postId);
            let message = '';
            if (postTarget.title && postTarget.text) {
                message = `${postTarget.title}\n\n${postTarget.text}`;
            }
            else {
                message = postTarget.title || postTarget.text || mainCaption || '';
            }
            message = (0, format_captions_with_tags_1.formatCaptionWithTags)(message, postTarget.tags, 'facebook');
            if (mediaAssets.length === 0) {
                const payload = {
                    message,
                    access_token: accessToken,
                };
                const response = await this.httpClient.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, payload);
                this.logger.info('Facebook text post created successfully', {
                    operation: 'sendPostToFacebook',
                    userId,
                    postId,
                    facebookPostId: response.id,
                });
            }
            else if (mediaAssets.length === 1) {
                const mediaAsset = mediaAssets[0];
                let endpoint = `${pageId}/feed`;
                const payload = {
                    access_token: accessToken,
                };
                if (mediaAsset.type?.startsWith('image')) {
                    endpoint = `${pageId}/photos`;
                    payload.url = mediaAsset.url;
                    payload.message = message;
                }
                else if (mediaAsset.type?.startsWith('video')) {
                    endpoint = `${pageId}/videos`;
                    payload.file_url = mediaAsset.url;
                    payload.description = message;
                }
                const response = await this.httpClient.post(`https://graph.facebook.com/v18.0/${endpoint}`, payload);
                this.logger.info('Facebook single media post created successfully', {
                    operation: 'sendPostToFacebook',
                    userId,
                    postId,
                    facebookPostId: response.id,
                    mediaType: mediaAsset.type?.startsWith('image') ? 'image' : 'video',
                });
            }
            else {
                const hasVideo = mediaAssets.some((asset) => asset.type?.startsWith('video'));
                if (hasVideo) {
                    throw new base_error_1.BaseAppError('Facebook multi-media posts only support images, not videos', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const photoIds = [];
                const temporaryUploads = [];
                try {
                    for (const [index, asset] of mediaAssets.entries()) {
                        const { url: resizedUrl, isTemporary } = await this.getOrCreateResizedImage(asset.url, userId, postId, index);
                        if (isTemporary) {
                            temporaryUploads.push(resizedUrl);
                        }
                        this.logger.info('Using image for Facebook', {
                            operation: 'sendPostToFacebook',
                            userId,
                            postId,
                            assetIndex: index + 1,
                            originalUrl: asset.url,
                            resizedUrl,
                        });
                        const photoResponse = await this.httpClient.post(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
                            url: resizedUrl,
                            published: false,
                            access_token: accessToken,
                        });
                        photoIds.push(photoResponse.id);
                    }
                    const multiPhotoPayload = {
                        message,
                        attached_media: photoIds.map((id) => ({ media_fbid: id })),
                        access_token: accessToken,
                    };
                    const response = await this.httpClient.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, multiPhotoPayload);
                    this.logger.info('Facebook multi-image post created successfully', {
                        operation: 'sendPostToFacebook',
                        userId,
                        postId,
                        facebookPostId: response.id,
                        mediaCount: mediaAssets.length,
                    });
                }
                finally {
                    await this.cleanupTemporaryUploads(temporaryUploads);
                }
            }
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'facebook', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
}
exports.FacebookContentPublisherService = FacebookContentPublisherService;
