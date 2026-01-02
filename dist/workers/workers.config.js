"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeWorkers = initializeWorkers;
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
const queue_1 = require("@/shared/queue");
const inspirations_repository_1 = require("@/modules/inspiration/repositories/inspirations.repository");
const inspirations_extraction_repository_1 = require("@/modules/inspiration/repositories/inspirations-extraction.repository");
const workspace_tags_repository_1 = require("@/modules/inspiration/repositories/workspace-tags.repository");
const content_parser_service_1 = require("@/modules/inspiration/services/content-parser/content-parser.service");
const llm_extraction_service_1 = require("@/modules/inspiration/services/llm-extraction/llm-extraction.service");
async function initializeWorkers(logger, db, socialMediaPostSender, socialMediaTokenRefresher, postsService) {
    const accessTokensRefreshScheduler = new queue_1.BullMqTokenRefreshScheduler();
    await accessTokensRefreshScheduler.scheduleDailyAccessTokenRefresh();
    const postWorkers = posts_schemas_1.PostPlatformsWithoutX.map((platform) => {
        const worker = new queue_1.BullMqPostWorker(platform, socialMediaPostSender);
        // Set up failure callback to update base post status
        console.log(`[WORKERS] Setting up failure callback for ${platform}, postsService:`, !!postsService);
        worker.setOnJobFailureCallback(postsService.checkAndUpdateBasePostStatus.bind(postsService));
        worker.start();
        return worker;
    });
    const accessTokensRefreshWorker = new queue_1.BullMqAccessTokenWorker(logger, socialMediaTokenRefresher);
    accessTokensRefreshWorker.start();
    // Initialize inspiration worker
    const inspirationsRepository = new inspirations_repository_1.InspirationsRepository(db, logger);
    const extractionsRepository = new inspirations_extraction_repository_1.InspirationsExtractionRepository(db, logger);
    const tagsRepository = new workspace_tags_repository_1.WorkspaceTagsRepository(db, logger);
    const contentParser = new content_parser_service_1.ContentParserService(logger);
    const llmExtraction = new llm_extraction_service_1.LLMExtractionService(logger);
    const inspirationWorker = new queue_1.BullMqInspirationWorker(logger, db, inspirationsRepository, extractionsRepository, tagsRepository, contentParser, llmExtraction);
    inspirationWorker.start();
    return {
        accessTokensRefreshScheduler,
        accessTokensRefreshWorker,
        postWorkers,
        inspirationWorker,
    };
}
