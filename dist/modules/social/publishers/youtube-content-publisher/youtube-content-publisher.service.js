"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
class YouTubeContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler) {
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
    }
    async sendPostToYouTube(postTarget, userId, postId, mainCaption) {
        try {
            const mediaAsset = await this.postRepository.getPostMediaAsset(postId);
            if (!mediaAsset?.url || !mediaAsset.type?.startsWith('video')) {
                throw new base_error_1.BaseAppError('YouTube posts require video content', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const { accessToken } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const title = postTarget.title || 'Video Upload';
            const description = postTarget.text || mainCaption || '';
            const initResponse = await this.httpClient.post('https://www.googleapis.com/upload/youtube/v3/videos', {
                snippet: {
                    title,
                    description,
                    categoryId: '22',
                },
                status: {
                    privacyStatus: 'public',
                },
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Upload-Content-Type': mediaAsset.type,
                    'X-Upload-Content-Length': '0',
                },
                params: {
                    part: 'snippet,status',
                    uploadType: 'resumable',
                },
            });
            const uploadUrl = initResponse.headers.location;
            if (!uploadUrl) {
                throw new base_error_1.BaseAppError('Failed to initialize YouTube upload', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
            }
            const videoResponse = await this.httpClient.get(mediaAsset.url, {
                responseType: 'stream',
            });
            const uploadResponse = await this.httpClient.put(uploadUrl, videoResponse, {
                headers: {
                    'Content-Type': mediaAsset.type,
                },
            });
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('YouTube video uploaded successfully', {
                operation: 'sendPostToYouTube',
                userId,
                postId,
                videoId: uploadResponse.data?.id,
            });
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'youtube', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
}
exports.YouTubeContentPublisherService = YouTubeContentPublisherService;
