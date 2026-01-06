"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinterestContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
const form_data_1 = __importDefault(require("form-data"));
class PinterestContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler) {
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
    }
    async sendPostToPinterest(postTarget, userId, postId, pinterestBoardId, mainCaption) {
        try {
            const { PINTEREST_API_URL, PINTEREST_API_VERSION } = process.env;
            if (!PINTEREST_API_URL || !PINTEREST_API_VERSION) {
                throw new base_error_1.BaseAppError('Lack of required environment variables for Pinteres', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const { accessToken } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const mediaAsset = await this.postRepository.getPostMediaAsset(postId);
            if (!mediaAsset?.url)
                throw new base_error_1.BaseAppError('Media asset not found for Pinterest post', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            if (!pinterestBoardId)
                throw new base_error_1.BaseAppError('Pinterest board ID is required', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            const isVideo = mediaAsset.type?.startsWith('video');
            const isImage = mediaAsset.type?.startsWith('image');
            if (!isVideo && !isImage) {
                throw new base_error_1.BaseAppError('Unsupported media type for Pinterest', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            let mediaSource;
            if (isVideo) {
                this.logger.debug('Processing video for Pinterest', {
                    operation: 'sendPostToPinterest',
                    userId,
                    postId,
                    mediaType: 'video',
                });
                const registerResponse = await this.httpClient.post(`${PINTEREST_API_URL}/${PINTEREST_API_VERSION}/media`, { media_type: 'video' }, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                const { media_id, upload_url, upload_parameters } = registerResponse;
                this.logger.debug('Media upload registered', {
                    operation: 'sendPostToPinterest',
                    mediaId: media_id,
                });
                const videoResponse = await this.httpClient.get(mediaAsset.url, {
                    responseType: 'stream',
                });
                const uploadForm = new form_data_1.default();
                Object.entries(upload_parameters).forEach(([key, value]) => {
                    uploadForm.append(key, value);
                });
                uploadForm.append('file', videoResponse);
                await this.httpClient.post(upload_url, uploadForm, {
                    headers: {
                        ...uploadForm.getHeaders(),
                    },
                });
                this.logger.debug('Video uploaded to Pinterest', {
                    operation: 'sendPostToPinterest',
                    mediaId: media_id,
                });
                mediaSource = {
                    source_type: 'video_id',
                    video_id: media_id,
                };
            }
            else {
                mediaSource = {
                    source_type: 'image_url',
                    url: mediaAsset.url,
                };
            }
            const pinData = {
                board_id: pinterestBoardId,
                media_source: mediaSource,
                ...(postTarget.text || mainCaption ? { description: postTarget.text || mainCaption } : {}),
                ...(postTarget.title ? { title: postTarget.title } : {}),
            };
            const response = await this.httpClient.post(`${PINTEREST_API_URL}/${PINTEREST_API_VERSION}/pins`, pinData, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('Pinterest pin created successfully', {
                operation: 'sendPostToPinterest',
                userId,
                postId,
                pinterestBoardId,
                mediaType: isVideo ? 'video' : 'image',
                pinId: response.id,
            });
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'pinterest', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
}
exports.PinterestContentPublisherService = PinterestContentPublisherService;
