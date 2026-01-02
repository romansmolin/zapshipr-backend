"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMediaConnectorFactory = void 0;
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const bluesky_connector_service_1 = require("../connectors/bluesky-connector-service/bluesky-connector.service");
const facebook_connector_service_1 = require("../connectors/facebook-connector-service/facebook-connector.service");
const linkedin_connector_service_1 = require("../connectors/linkedin-connector-service/linkedin-connector.service");
const instagram_connector_service_1 = require("../connectors/instagram-connector-service/instagram-connector.service");
const pinterest_connector_service_1 = require("../connectors/pinterest-connector-service/pinterest-connector.service");
const tiktok_connector_service_1 = require("../connectors/tiktok-connector-service/tiktok-connector.service");
const threads_connector_service_1 = require("../connectors/threads-connector-service/threads-connector.service");
const youtube_connector_service_1 = require("../connectors/youtube-connector-service/youtube-connector.service");
const x_connector_service_1 = require("../connectors/x-connector-service/x-connector.service");
class SocialMediaConnectorFactory {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.blueskyConnectorService = new bluesky_connector_service_1.BlueskyConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.facebookConnectorService = new facebook_connector_service_1.FacebookConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.linkedinConnectorService = new linkedin_connector_service_1.LinkedinConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.instagramConnectorService = new instagram_connector_service_1.InstagramConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.pinterestConnectorService = new pinterest_connector_service_1.PinterestConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.tiktokConnectorService = new tiktok_connector_service_1.TikTokConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.threadsConnectorService = new threads_connector_service_1.ThreadsConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.youtubeConnectorService = new youtube_connector_service_1.YouTubeConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
        this.xConnectorService = new x_connector_service_1.XConnectorService(logger, httpClient, mediaUploader, accountRepository, accountService);
    }
    create(platform) {
        switch (platform) {
            case posts_schemas_1.SocilaMediaPlatform.BLUESKY:
                return this.blueskyConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.FACEBOOK:
                return this.facebookConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.LINKEDIN:
                return this.linkedinConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.INSTAGRAM:
                return this.instagramConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.PINTEREST:
                return this.pinterestConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.TIKTOK:
                return this.tiktokConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.THREADS:
                return this.threadsConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.YOUTUBE:
                return this.youtubeConnectorService;
            case posts_schemas_1.SocilaMediaPlatform.X:
                return this.xConnectorService;
            default: {
                throw new base_error_1.BaseAppError(`Unknown platform connector - ${platform}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
            }
        }
    }
}
exports.SocialMediaConnectorFactory = SocialMediaConnectorFactory;
