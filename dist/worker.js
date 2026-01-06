"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@/db/client");
const posts_repository_1 = require("@/modules/post/repositories/posts.repository");
const posts_service_1 = require("@/modules/post/services/posts.service");
const socia_media_publisher_factory_1 = require("@/modules/social/factories/socia-media-publisher.factory");
const account_repository_1 = require("@/modules/social/repositories/account.repository");
const social_media_post_sender_service_1 = require("@/modules/social/services/social-media-post-sender.service");
const social_media_token_refresher_service_1 = require("@/modules/social/services/social-media-token-refresher.service");
const http_client_1 = require("@/shared/http-client");
const social_media_errors_1 = require("@/shared/social-media-errors");
const video_processor_1 = require("@/shared/video-processor/video-processor");
const console_logger_1 = require("@/shared/logger/console-logger");
const media_uploader_1 = require("@/shared/media-uploader/media-uploader");
const workers_config_1 = require("@/workers/workers.config");
async function startWorkers() {
    const logger = new console_logger_1.ConsoleLogger();
    const accountRepository = new account_repository_1.AccountRepository(client_1.db, logger);
    const postsRepository = new posts_repository_1.PostsRepository(client_1.db, logger);
    const mediaUploader = new media_uploader_1.S3Uploader(logger);
    const apiClient = new http_client_1.AxiosHttpClient();
    const socialMediaErrorHandler = new social_media_errors_1.SocialMediaErrorHandler(logger);
    const videoProcessor = new video_processor_1.VideoProcessor(logger);
    const socialMediaPublisherFactory = new socia_media_publisher_factory_1.SocialMediaPublisherFactory(logger, accountRepository, postsRepository, apiClient, socialMediaErrorHandler, videoProcessor, mediaUploader);
    const socialMediaPostSender = new social_media_post_sender_service_1.SocialMediaPostSenderService(postsRepository, logger, socialMediaErrorHandler, socialMediaPublisherFactory);
    const socialMediaTokenRefresher = new social_media_token_refresher_service_1.SocialMediaTokenRefresherService(logger, accountRepository);
    const postsService = new posts_service_1.PostsService(postsRepository, mediaUploader, logger, socialMediaPostSender, socialMediaErrorHandler);
    await (0, workers_config_1.initializeWorkers)(logger, client_1.db, socialMediaPostSender, socialMediaTokenRefresher, postsService);
    logger.info('BullMQ workers started successfully');
}
startWorkers().catch((error) => {
    console.error('Failed to start workers:', error);
    process.exit(1);
});
