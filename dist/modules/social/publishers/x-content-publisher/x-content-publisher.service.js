"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
const format_captions_with_tags_1 = require("../../utils/format-captions-with-tags");
const form_data_1 = __importDefault(require("form-data"));
class XContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler) {
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
    }
    async sendPostToX(postTarget, userId, postId, mainCaption) {
        try {
            const { accessToken } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const mediaAssets = await this.postRepository.getPostMediaAssets(postId);
            const text = (0, format_captions_with_tags_1.formatCaptionWithTags)(postTarget.text || mainCaption || '', postTarget.tags, 'x');
            const payload = { text };
            if (mediaAssets.length > 0) {
                if (mediaAssets.length > 4) {
                    throw new base_error_1.BaseAppError('X (Twitter) supports maximum 4 media files per tweet', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const hasVideo = mediaAssets.some((asset) => asset.type?.startsWith('video'));
                const hasImage = mediaAssets.some((asset) => asset.type?.startsWith('image'));
                if (hasVideo && hasImage) {
                    throw new base_error_1.BaseAppError('X (Twitter) does not support mixed media types (video + images)', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                if (hasVideo && mediaAssets.length > 1) {
                    throw new base_error_1.BaseAppError('X (Twitter) only supports one video per tweet', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const mediaIds = [];
                for (const mediaAsset of mediaAssets) {
                    const mediaResponse = await this.httpClient.get(mediaAsset.url, {
                        responseType: 'arraybuffer',
                    });
                    const mediaBuffer = Buffer.isBuffer(mediaResponse) ? mediaResponse : Buffer.from(mediaResponse);
                    if (mediaAsset.type?.startsWith('image')) {
                        const formData = new form_data_1.default();
                        formData.append('media', mediaBuffer, {
                            filename: 'image.jpg',
                            contentType: mediaAsset.type,
                        });
                        const uploadResponse = await this.httpClient.post('https://upload.twitter.com/1.1/media/upload.json', formData, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                ...formData.getHeaders(),
                            },
                        });
                        mediaIds.push(uploadResponse.media_id_string);
                    }
                    else if (mediaAsset.type?.startsWith('video')) {
                        const totalBytes = mediaBuffer.length;
                        const initFormData = new form_data_1.default();
                        initFormData.append('command', 'INIT');
                        initFormData.append('media_type', mediaAsset.type);
                        initFormData.append('total_bytes', totalBytes.toString());
                        initFormData.append('media_category', 'tweet_video');
                        const initResponse = await this.httpClient.post('https://upload.twitter.com/1.1/media/upload.json', initFormData, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                ...initFormData.getHeaders(),
                            },
                        });
                        const mediaId = initResponse.media_id_string;
                        const appendFormData = new form_data_1.default();
                        appendFormData.append('command', 'APPEND');
                        appendFormData.append('media_id', mediaId);
                        appendFormData.append('segment_index', '0');
                        appendFormData.append('media', mediaBuffer, {
                            filename: 'video.mp4',
                            contentType: mediaAsset.type,
                        });
                        await this.httpClient.post('https://upload.twitter.com/1.1/media/upload.json', appendFormData, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                ...appendFormData.getHeaders(),
                            },
                        });
                        const finalizeFormData = new form_data_1.default();
                        finalizeFormData.append('command', 'FINALIZE');
                        finalizeFormData.append('media_id', mediaId);
                        await this.httpClient.post('https://upload.twitter.com/1.1/media/upload.json', finalizeFormData, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                ...finalizeFormData.getHeaders(),
                            },
                        });
                        mediaIds.push(mediaId);
                    }
                }
                if (mediaIds.length > 0) {
                    payload.media = {
                        media_ids: mediaIds,
                    };
                }
            }
            const response = await this.httpClient.post('https://api.x.com/2/tweets', payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('X post created successfully', {
                operation: 'sendPostToX',
                userId,
                postId,
                tweetId: response.data.id,
                mediaCount: mediaAssets.length,
            });
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'x', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
}
exports.XContentPublisherService = XContentPublisherService;
