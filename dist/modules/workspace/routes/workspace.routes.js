"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkspaceRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const async_handler_1 = require("@/shared/http/async-handler");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const media_uploader_1 = require("@/shared/media-uploader/media-uploader");
const workspace_repository_1 = require("../repositories/workspace.repository");
const workspace_service_1 = require("../services/workspace.service");
const workspace_controller_1 = require("../controllers/workspace.controller");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const createWorkspaceRouter = (logger, db) => {
    const router = (0, express_1.Router)();
    const repository = new workspace_repository_1.WorkspaceRepository(db, logger);
    const mediaUploader = new media_uploader_1.S3Uploader(logger);
    const service = new workspace_service_1.WorkspaceService(repository, mediaUploader, logger);
    const controller = new workspace_controller_1.WorkspaceController(service, logger);
    router.post('/workspaces', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.create.bind(controller)));
    router.get('/workspaces', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getAll.bind(controller)));
    router.get('/workspaces/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getById.bind(controller)));
    router.put('/workspaces/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.update.bind(controller)));
    router.delete('/workspaces/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.delete.bind(controller)));
    router.post('/workspaces/:id/avatar', auth_middleware_1.authMiddleware, upload.single('avatar'), (0, async_handler_1.asyncHandler)(controller.updateAvatar.bind(controller)));
    // Main Prompt endpoints
    router.get('/workspaces/:id/prompt', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getMainPrompt.bind(controller)));
    router.put('/workspaces/:id/prompt', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.updateMainPrompt.bind(controller)));
    return router;
};
exports.createWorkspaceRouter = createWorkspaceRouter;
