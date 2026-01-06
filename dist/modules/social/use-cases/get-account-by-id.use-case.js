"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAccountByIdUseCase = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const social_account_dto_1 = require("@/modules/social/entity/social-account.dto");
class GetAccountByIdUseCase {
    constructor(repo, logger) {
        this.repo = repo;
        this.logger = logger;
    }
    async execute({ userId, accountId }) {
        const account = await this.repo.getAccountById(userId, accountId);
        if (!account) {
            throw new base_error_1.BaseAppError('Social account not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        this.logger.info('Fetched social account', {
            operation: 'GetAccountByIdUseCase.execute',
            userId,
            accountId,
        });
        return (0, social_account_dto_1.toAccountResponse)(account);
    }
}
exports.GetAccountByIdUseCase = GetAccountByIdUseCase;
