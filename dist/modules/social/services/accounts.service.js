"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsService = void 0;
class AccountsService {
    constructor(connectAccountUseCase, listAccountsUseCase, getAccountByIdUseCase, deleteAccountUseCase, getPinterestBoardsUseCase, updateAccessTokenUseCase, updateAccessTokenByIdUseCase, findExpiringAccountsUseCase) {
        this.connectAccountUseCase = connectAccountUseCase;
        this.listAccountsUseCase = listAccountsUseCase;
        this.getAccountByIdUseCase = getAccountByIdUseCase;
        this.deleteAccountUseCase = deleteAccountUseCase;
        this.getPinterestBoardsUseCase = getPinterestBoardsUseCase;
        this.updateAccessTokenUseCase = updateAccessTokenUseCase;
        this.updateAccessTokenByIdUseCase = updateAccessTokenByIdUseCase;
        this.findExpiringAccountsUseCase = findExpiringAccountsUseCase;
    }
    async connectAccount(account) {
        return this.connectAccountUseCase.execute({ account });
    }
    async listAccounts(userId) {
        return this.listAccountsUseCase.execute({ userId });
    }
    async getAllAccounts(userId) {
        return this.listAccounts(userId);
    }
    async getAccountById(userId, accountId) {
        return this.getAccountByIdUseCase.execute({ userId, accountId });
    }
    async deleteAccount(userId, accountId) {
        return this.deleteAccountUseCase.execute({ userId, accountId });
    }
    async getPinterestBoards(userId, socialAccountId) {
        return this.getPinterestBoardsUseCase.execute({ userId, socialAccountId });
    }
    async updateAccessToken(userId, pageId, accessToken) {
        await this.updateAccessTokenUseCase.execute({ userId, pageId, accessToken });
    }
    async updateAccessTokenByAccountId(accountId, payload) {
        await this.updateAccessTokenByIdUseCase.execute({
            accountId,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresIn: payload.expiresIn,
            refreshTokenExpiresIn: payload.refreshTokenExpiresIn,
        });
    }
    async findAccountsWithExpiringAccessTokens() {
        return this.findExpiringAccountsUseCase.execute();
    }
}
exports.AccountsService = AccountsService;
