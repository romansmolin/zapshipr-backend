"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const app_error_1 = require("@/shared/errors/app-error");
class UserService {
    constructor(userRepository, logger) {
        this.userRepository = userRepository;
        this.logger = logger;
    }
    async getUserInfo(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            this.logger.warn('User not found', {
                operation: 'UserService.getUserInfo',
                userId,
            });
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.USER_NOT_FOUND,
                httpCode: 404,
            });
        }
        this.logger.info('User info retrieved', {
            operation: 'UserService.getUserInfo',
            userId,
        });
        return user;
    }
    async getUsageQuota(userId) {
        // TODO: Implement usage quota logic
        throw new Error('Not implemented');
    }
    async incrementConnectedAccountsUsage(userId) {
        // TODO: Implement increment logic
        throw new Error('Not implemented');
    }
    async decrementConnectedAccountsUsage(userId) {
        // TODO: Implement decrement logic
        throw new Error('Not implemented');
    }
    async getUserPlan(userId) {
        // TODO: Implement get user plan logic
        throw new Error('Not implemented');
    }
    async incrementAiUsage(userId) {
        // TODO: Implement increment AI usage logic
        throw new Error('Not implemented');
    }
}
exports.UserService = UserService;
