"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAccessTokenUseCase = void 0;
class UpdateAccessTokenUseCase {
    constructor(repo, logger) {
        this.repo = repo;
        this.logger = logger;
    }
    async execute({ userId, pageId, accessToken }) {
        await this.repo.updateAccessToken(userId, pageId, accessToken);
        this.logger.info('Updated social access token', {
            operation: 'UpdateAccessTokenUseCase.execute',
            userId,
            pageId,
        });
    }
}
exports.UpdateAccessTokenUseCase = UpdateAccessTokenUseCase;
