"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkspaceRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("@/shared/http/async-handler");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const workspace_repository_1 = require("../repositories/workspace.repository");
const workspace_service_1 = require("../services/workspace.service");
const workspace_controller_1 = require("../controllers/workspace.controller");
const createWorkspaceRouter = (logger, db) => {
    const router = (0, express_1.Router)();
    const repository = new workspace_repository_1.WorkspaceRepository(db, logger);
    const service = new workspace_service_1.WorkspaceService(repository, logger);
    const controller = new workspace_controller_1.WorkspaceController(service, logger);
    router.post('/workspaces', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.create.bind(controller)));
    router.get('/workspaces', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getAll.bind(controller)));
    router.get('/workspaces/default', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getDefault.bind(controller)));
    router.get('/workspaces/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getById.bind(controller)));
    router.put('/workspaces/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.update.bind(controller)));
    router.put('/workspaces/:id/default', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.setAsDefault.bind(controller)));
    router.delete('/workspaces/:id', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.delete.bind(controller)));
    // Main Prompt endpoints
    router.get('/workspaces/:id/prompt', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.getMainPrompt.bind(controller)));
    router.put('/workspaces/:id/prompt', auth_middleware_1.authMiddleware, (0, async_handler_1.asyncHandler)(controller.updateMainPrompt.bind(controller)));
    return router;
};
exports.createWorkspaceRouter = createWorkspaceRouter;
