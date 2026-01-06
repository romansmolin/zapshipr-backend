"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkspaceTagsRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("@/shared/http/async-handler");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const workspace_tags_repository_1 = require("../repositories/workspace-tags.repository");
const workspace_tags_service_1 = require("../services/workspace-tags/workspace-tags.service");
const workspace_tags_controller_1 = require("../controllers/workspace-tags.controller");
const createWorkspaceTagsRouter = (logger, db) => {
    const router = (0, express_1.Router)();
    const repository = new workspace_tags_repository_1.WorkspaceTagsRepository(db, logger);
    const service = new workspace_tags_service_1.WorkspaceTagsService(repository, logger);
    const controller = new workspace_tags_controller_1.WorkspaceTagsController(service, logger);
    // Workspace Tags endpoints
    router.get('/workspaces/:workspaceId/tags', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getTags.bind(controller)));
    router.post('/workspaces/:workspaceId/tags', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.createTag.bind(controller)));
    router.put('/workspaces/:workspaceId/tags/:tagId', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.updateTag.bind(controller)));
    router.delete('/workspaces/:workspaceId/tags/:tagId', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.deleteTag.bind(controller)));
    return router;
};
exports.createWorkspaceTagsRouter = createWorkspaceTagsRouter;
