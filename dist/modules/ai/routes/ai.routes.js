"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAiRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const async_handler_1 = require("@/shared/http/async-handler");
const ai_controller_1 = require("@/modules/ai/controllers/ai.controller");
const createAiRouter = (logger, aiService) => {
    const router = (0, express_1.Router)();
    const controller = new ai_controller_1.AiController(aiService, logger);
    router.use(auth_middleware_1.authMiddleware);
    router.post('/ai/content', (0, async_handler_1.asyncHandler)(controller.generateIntroductoryCopy.bind(controller)));
    return router;
};
exports.createAiRouter = createAiRouter;
