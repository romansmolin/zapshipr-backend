"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocilaMediaConnectorService = void 0;
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
const social_media_connector_factory_1 = require("@/modules/social/factories/social-media-connector.factory");
class SocilaMediaConnectorService {
    constructor(logger, mediaUploader, accountRepository, apiClient, accountsService) {
        this.connectorFactory = new social_media_connector_factory_1.SocialMediaConnectorFactory(logger, apiClient, mediaUploader, accountRepository, accountsService);
    }
    async connectFacebookAccount(userId, code) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.FACEBOOK);
        return connector.connectFacebookAccount(userId, code);
    }
    async connectInstagramAccount(userId, code) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.INSTAGRAM);
        return connector.connectInstagramAccount(userId, code);
    }
    async connectThreadsAccount(userId, code) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.THREADS);
        return connector.connectThreadsAccount(userId, code);
    }
    async connectTikTokAccount(userId, code) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.TIKTOK);
        return connector.connectTikTokAccount(userId, code);
    }
    async connectYouTubeAccount(userId, code) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.YOUTUBE);
        return connector.connectYouTubeAccount(userId, code);
    }
    async connectBlueskyAccount(userId, identifier, appPassword) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.BLUESKY);
        return connector.connectBlueskyAccount(userId, identifier, appPassword);
    }
    async connectXAccount(userId, code, codeVerifier) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.X);
        return connector.connectXAccount(userId, code, codeVerifier);
    }
    async connectPinterestAccount(userId, code) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.PINTEREST);
        return connector.connectPinterestAccount(userId, code);
    }
    async connectLinkedinAccount(userId, code) {
        const connector = this.connectorFactory.create(posts_schemas_1.SocilaMediaPlatform.LINKEDIN);
        return connector.connectLinkedinAccount(userId, code);
    }
}
exports.SocilaMediaConnectorService = SocilaMediaConnectorService;
