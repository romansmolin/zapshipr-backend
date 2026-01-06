"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAccessTokenByIdUseCase = void 0;
class UpdateAccessTokenByIdUseCase {
    constructor(repo, logger) {
        this.repo = repo;
        this.logger = logger;
    }
    async execute({ accountId, accessToken, refreshToken, expiresIn, refreshTokenExpiresIn, }) {
        await this.repo.updateAccessTokenByAccountId(accountId, expiresIn, accessToken, refreshToken, refreshTokenExpiresIn);
        this.logger.info('Updated social access token by account', {
            operation: 'UpdateAccessTokenByIdUseCase.execute',
            accountId,
        });
    }
}
exports.UpdateAccessTokenByIdUseCase = UpdateAccessTokenByIdUseCase;
