"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectAccountUseCase = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const social_account_dto_1 = require("@/modules/social/entity/social-account.dto");
class ConnectAccountUseCase {
    constructor(repo, logger, userService) {
        this.repo = repo;
        this.logger = logger;
        this.userService = userService;
    }
    async execute({ account }) {
        const existing = await this.repo.findByTenantPlatformAndPage(account.userId, account.platform, account.pageId);
        if (existing) {
            const updated = await this.repo.updateAccountByTenantPlatformAndPage({
                userId: account.userId,
                platform: account.platform,
                pageId: account.pageId,
                username: account.username,
                accessToken: account.accessToken,
                connectedAt: account.connectedAt ?? new Date(),
                picture: account.picture ?? null,
                refreshToken: account.refreshToken ?? null,
                expiresIn: account.expiresIn ?? null,
                refreshExpiresIn: account.refreshExpiresIn ?? null,
                maxVideoPostDurationSec: account.maxVideoPostDurationSec ?? null,
                privacyLevelOptions: account.privacyLevelOptions ?? null,
            });
            return {
                isNew: false,
                account: (0, social_account_dto_1.toAccountResponse)(updated),
            };
        }
        if (this.userService) {
            const usage = await this.userService.getUsageQuota(account.userId);
            const { used, limit } = usage.connectedAccounts;
            if (used >= limit) {
                throw new base_error_1.BaseAppError('Account limit reached for the current plan', error_codes_const_1.ErrorCode.PLAN_LIMIT_REACHED, 403);
            }
        }
        const created = await this.repo.save(account);
        if (this.userService) {
            await this.userService.incrementConnectedAccountsUsage(account.userId);
        }
        this.logger.info('Social account connected', {
            operation: 'ConnectAccountUseCase.execute',
            userId: account.userId,
            platform: account.platform,
            pageId: account.pageId,
        });
        return {
            isNew: true,
            account: (0, social_account_dto_1.toAccountResponse)(created),
        };
    }
}
exports.ConnectAccountUseCase = ConnectAccountUseCase;
