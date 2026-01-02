"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMediaPublisherFactory = void 0;
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const bluesky_content_publisher_service_1 = require("../publishers/bluesky-content-publisher/bluesky-content-publisher.service");
const facebook_content_publisher_service_1 = require("../publishers/facebook-content-publisher/facebook-content-publisher.service");
const linkedin_content_publisher_service_1 = require("../publishers/linkedin-content-publisher/linkedin-content-publisher.service");
const instagram_content_publisher_service_1 = require("../publishers/instagram-content-publisher/instagram-content-publisher.service");
const pinterest_content_publisher_service_1 = require("../publishers/pinterest-content-publisher/pinterest-content-publisher.service");
const threads_content_publisher_service_1 = require("../publishers/threads-content-publisher/threads-content-publisher.service");
const tiktok_content_publisher_service_1 = require("../publishers/tiktok-content-publisher/tiktok-content-publisher.service");
const youtube_content_publisher_service_1 = require("../publishers/youtube-content-publisher/youtube-content-publisher.service");
const x_content_publisher_service_1 = require("../publishers/x-content-publisher/x-content-publisher.service");
const image_processor_1 = require("@/shared/image-processor/image-processor");
class SocialMediaPublisherFactory {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler, videoProcessor, mediaUploader, imageProcessor) {
        const sharedImageProcessor = imageProcessor ?? new image_processor_1.ImageProcessor(logger);
        this.blueskyPublisher = new bluesky_content_publisher_service_1.BlueskyContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler);
        this.facebookPublisher = new facebook_content_publisher_service_1.FacebookContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler, sharedImageProcessor, mediaUploader);
        this.linkedinPublisher = new linkedin_content_publisher_service_1.LinkedinContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler);
        this.instagramPublisher = new instagram_content_publisher_service_1.InstagramContentPublisherService(logger, accountRepository, postRepository, videoProcessor, socialMediaErrorHandler, mediaUploader, httpClient);
        this.pinterestPublisher = new pinterest_content_publisher_service_1.PinterestContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler);
        this.threadsPublisher = new threads_content_publisher_service_1.ThreadsContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler);
        this.tiktokPublisher = new tiktok_content_publisher_service_1.TikTokContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler, videoProcessor, sharedImageProcessor, mediaUploader);
        this.youtubePublisher = new youtube_content_publisher_service_1.YouTubeContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler);
        this.xPublisher = new x_content_publisher_service_1.XContentPublisherService(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler);
    }
    create(platform) {
        switch (platform) {
            case posts_schemas_1.SocilaMediaPlatform.BLUESKY:
                return this.blueskyPublisher;
            case posts_schemas_1.SocilaMediaPlatform.FACEBOOK:
                return this.facebookPublisher;
            case posts_schemas_1.SocilaMediaPlatform.LINKEDIN:
                return this.linkedinPublisher;
            case posts_schemas_1.SocilaMediaPlatform.INSTAGRAM:
                return this.instagramPublisher;
            case posts_schemas_1.SocilaMediaPlatform.PINTEREST:
                return this.pinterestPublisher;
            case posts_schemas_1.SocilaMediaPlatform.THREADS:
                return this.threadsPublisher;
            case posts_schemas_1.SocilaMediaPlatform.TIKTOK:
                return this.tiktokPublisher;
            case posts_schemas_1.SocilaMediaPlatform.X:
                return this.xPublisher;
            case posts_schemas_1.SocilaMediaPlatform.YOUTUBE:
                return this.youtubePublisher;
            default: {
                throw new base_error_1.BaseAppError(`Unknown platform publisher - ${platform}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
            }
        }
    }
    async publish(platform, postTarget, userId, postId, options) {
        const mainCaption = options?.mainCaption;
        const post = options?.post;
        switch (platform) {
            case posts_schemas_1.SocilaMediaPlatform.THREADS:
                return this.threadsPublisher.sendPostToThreads(postTarget, userId, postId, mainCaption, post);
            case posts_schemas_1.SocilaMediaPlatform.INSTAGRAM:
                return this.instagramPublisher.sendPostToInstagram(postTarget, userId, postId, mainCaption, post);
            case posts_schemas_1.SocilaMediaPlatform.PINTEREST:
                return this.pinterestPublisher.sendPostToPinterest(postTarget, userId, postId, postTarget.pinterestBoardId ?? null, mainCaption);
            case posts_schemas_1.SocilaMediaPlatform.FACEBOOK:
                return this.facebookPublisher.sendPostToFacebook(postTarget, userId, postId, mainCaption);
            case posts_schemas_1.SocilaMediaPlatform.YOUTUBE:
                return this.youtubePublisher.sendPostToYouTube(postTarget, userId, postId, mainCaption);
            case posts_schemas_1.SocilaMediaPlatform.BLUESKY:
                return this.blueskyPublisher.sendPostToBluesky(postTarget, userId, postId, mainCaption);
            case posts_schemas_1.SocilaMediaPlatform.TIKTOK:
                return this.tiktokPublisher.sendPostToTikTok(postTarget, userId, postId, mainCaption, post);
            case posts_schemas_1.SocilaMediaPlatform.X:
                return this.xPublisher.sendPostToX(postTarget, userId, postId, mainCaption);
            case posts_schemas_1.SocilaMediaPlatform.LINKEDIN:
                return this.linkedinPublisher.sendPostToLinkedin(postTarget, userId, postId, mainCaption);
            default:
                throw new base_error_1.BaseAppError(`Unknown platform publisher - ${platform}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
}
exports.SocialMediaPublisherFactory = SocialMediaPublisherFactory;
