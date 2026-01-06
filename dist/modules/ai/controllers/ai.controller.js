"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiController = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const ai_schemas_1 = require("@/modules/ai/validation/ai.schemas");
class AiController {
    constructor(aiService, logger) {
        this.aiService = aiService;
        this.logger = logger;
    }
    async generateIntroductoryCopy(req, res, next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const payload = ai_schemas_1.aiRequestSchema.parse(req.body);
        const result = await this.aiService.generateIntroductoryCopy(userId, payload);
        this.logger.info('AI content request handled', {
            operation: 'AiController.generateIntroductoryCopy',
            userId,
            items: result.length,
        });
        res.json(result);
    }
}
exports.AiController = AiController;
