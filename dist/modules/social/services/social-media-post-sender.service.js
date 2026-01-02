"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMediaPostSenderService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
class SocialMediaPostSenderService {
    constructor(postRepository, logger, errorHandler, socialMediaPublisherFactory) {
        this.postRepository = postRepository;
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.socialMediaPublisherFactory = socialMediaPublisherFactory;
    }
    setOnPostSuccessCallback(callback) {
        this.onPostSuccessCallback = callback;
    }
    setOnPostFailureCallback(callback) {
        this.onPostFailureCallback = callback;
    }
    async sendPost(userId, postId, platform, socialAccountId) {
        try {
            const post = await this.postRepository.getPostDetails(postId, userId);
            const targetForPlatform = socialAccountId
                ? post.targets.find((target) => target.platform === platform && target.socialAccountId === socialAccountId)
                : post.targets.find((target) => target.platform === platform);
            if (!targetForPlatform) {
                throw new base_error_1.BaseAppError(`No target found for platform: ${platform}${socialAccountId ? ` and socialAccountId: ${socialAccountId}` : ''}`, error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            if (post.status === posts_types_1.PostStatus.DRAFT) {
                this.logger.info('Skipping draft post', {
                    operation: 'sendPost',
                    userId,
                    postId,
                    platform,
                    status: post.status,
                });
                return;
            }
            if (post.status !== posts_types_1.PostStatus.POSTING) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.POSTING, new Date(), undefined);
            }
            await this.socialMediaPublisherFactory.publish(platform, targetForPlatform, userId, postId, {
                mainCaption: post.mainCaption ?? undefined,
                post,
            });
            if (this.onPostSuccessCallback) {
                await this.onPostSuccessCallback(userId, postId);
            }
            this.logger.info('Successfully sent post to platform', {
                operation: 'sendPost',
                userId,
                postId,
                platform,
            });
        }
        catch (error) {
            if (this.onPostFailureCallback) {
                await this.onPostFailureCallback(userId, postId);
            }
            const errorResult = await this.errorHandler.handleSocialMediaError(error, platform, userId, postId, socialAccountId || '');
            throw errorResult.error;
        }
    }
    async sendPostToAllPlatforms(userId, postId) {
        try {
            const post = await this.postRepository.getPostDetails(postId, userId);
            this.logger.info('Starting to send post to all platforms', {
                operation: 'sendPostToAllPlatforms',
                userId,
                postId,
                platforms: post.targets.map((t) => t.platform),
                targetCount: post.targets.length,
            });
            await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.POSTING, new Date(), undefined);
            const results = await Promise.allSettled(post.targets.map((target) => this.sendPost(userId, postId, target.platform, target.socialAccountId)));
            const failures = results.filter((result) => result.status === 'rejected');
            const successes = results.filter((result) => result.status === 'fulfilled');
            if (failures.length === results.length) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.FAILED, new Date(), undefined);
                this.logger.error('All platforms failed for post', {
                    operation: 'sendPostToAllPlatforms',
                    userId,
                    postId,
                    totalPlatforms: results.length,
                    failureCount: failures.length,
                });
                throw new base_error_1.BaseAppError(`Failed to send post to all ${failures.length} platform(s)`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
            }
            else if (successes.length === results.length) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.DONE, new Date(), undefined);
            }
            else if (successes.length !== results.length && failures.length !== results.length) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.PARTIALLY_DONE, new Date(), undefined);
            }
            this.logger.info('Post sending completed', {
                operation: 'sendPostToAllPlatforms',
                userId,
                postId,
                totalPlatforms: results.length,
                successCount: successes.length,
                failureCount: failures.length,
                status: successes.length > 0 ? 'partial_success' : 'all_failed',
            });
            if (failures.length > 0 && successes.length > 0) {
                this.logger.warn('Some platforms failed during post sending', {
                    operation: 'sendPostToAllPlatforms',
                    userId,
                    postId,
                    failureCount: failures.length,
                    successCount: successes.length,
                });
            }
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to send post to all platforms', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.SocialMediaPostSenderService = SocialMediaPostSenderService;
