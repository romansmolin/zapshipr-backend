"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindExpiringAccountsUseCase = void 0;
class FindExpiringAccountsUseCase {
    constructor(repo, logger) {
        this.repo = repo;
        this.logger = logger;
    }
    async execute() {
        const { accountsSnapshots } = await this.repo.findAccountsWithExpiringAccessTokens();
        this.logger.info('Fetched accounts with expiring tokens', {
            operation: 'FindExpiringAccountsUseCase.execute',
            count: accountsSnapshots.length,
        });
        return accountsSnapshots;
    }
}
exports.FindExpiringAccountsUseCase = FindExpiringAccountsUseCase;
