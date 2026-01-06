"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAccountsUseCase = void 0;
const social_account_dto_1 = require("@/modules/social/entity/social-account.dto");
class ListAccountsUseCase {
    constructor(repo, logger) {
        this.repo = repo;
        this.logger = logger;
    }
    async execute({ userId }) {
        const accounts = await this.repo.getAllAccounts(userId);
        this.logger.info('Fetched social accounts', {
            operation: 'ListAccountsUseCase.execute',
            userId,
            count: accounts.length,
        });
        return accounts.map((account) => (0, social_account_dto_1.toAccountResponse)(account));
    }
}
exports.ListAccountsUseCase = ListAccountsUseCase;
