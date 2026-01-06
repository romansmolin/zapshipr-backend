"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInspirationsRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const async_handler_1 = require("@/shared/http/async-handler");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const media_uploader_1 = require("@/shared/media-uploader/media-uploader");
const queue_1 = require("@/shared/queue");
const inspirations_repository_1 = require("../repositories/inspirations.repository");
const inspirations_service_1 = require("../services/inspirations.service");
const inspirations_controller_1 = require("../controllers/inspirations.controller");
const content_parser_service_1 = require("../services/content-parser/content-parser.service");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
});
const createInspirationsRouter = (logger, db) => {
    const router = (0, express_1.Router)();
    const repository = new inspirations_repository_1.InspirationsRepository(db, logger);
    const mediaUploader = new media_uploader_1.S3Uploader(logger);
    const scheduler = new queue_1.BullMqInspirationScheduler();
    const contentParser = new content_parser_service_1.ContentParserService(logger);
    const service = new inspirations_service_1.InspirationsService(repository, mediaUploader, scheduler, contentParser, logger);
    const controller = new inspirations_controller_1.InspirationsController(service, logger);
    router.post('/workspaces/:workspaceId/inspirations', auth_middleware_1.authMiddleware, upload.fields([
        { name: 'file', maxCount: 1 },
        { name: 'content', maxCount: 1 },
    ]), (0, async_handler_1.asyncHandler)(controller.create.bind(controller)));
    router.get('/workspaces/:workspaceId/inspirations', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getAll.bind(controller)));
    router.get('/workspaces/:workspaceId/inspirations/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getById.bind(controller)));
    router.put('/workspaces/:workspaceId/inspirations/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.update.bind(controller)));
    router.delete('/workspaces/:workspaceId/inspirations/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.delete.bind(controller)));
    router.post('/workspaces/:workspaceId/inspirations/:id/retry', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.retry.bind(controller)));
    return router;
};
exports.createInspirationsRouter = createInspirationsRouter;
