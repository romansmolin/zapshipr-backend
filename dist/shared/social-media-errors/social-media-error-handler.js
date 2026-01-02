"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMediaErrorHandler = void 0;
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
class SocialMediaErrorHandler {
    constructor(logger) {
        this.logger = logger;
    }
    async handleSocialMediaError(error, platform, userId, postId, socialAccountId) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Social media operation failed', {
            operation: 'handleSocialMediaError',
            platform,
            userId,
            postId,
            socialAccountId,
            error: {
                name: error instanceof Error ? error.name : 'UnknownError',
                message,
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
        if (error instanceof base_error_1.BaseAppError) {
            return { error };
        }
        return { error: new base_error_1.BaseAppError(message, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500) };
    }
}
exports.SocialMediaErrorHandler = SocialMediaErrorHandler;
