"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountRepository = void 0;
const app_error_1 = require("@/shared/errors/app-error");
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const account_1 = require("@/modules/social/entity/account");
const pinterest_board_1 = require("@/modules/social/entity/pinterest-board");
const social_accounts_repository_1 = require("@/modules/social/repositories/social-accounts.repository");
class AccountRepository {
    constructor(db, logger) {
        this.repository = new social_accounts_repository_1.SocialAccountsRepository(db, logger);
    }
    async save(account) {
        try {
            const created = await this.repository.saveAccount(this.toNewSocialAccount(account));
            return this.toAccount(created);
        }
        catch (error) {
            if (error instanceof app_error_1.AppError && error.errorMessageCode === app_error_1.ErrorMessageCode.SOCIAL_ACCOUNT_ALREADY_EXISTS) {
                throw new base_error_1.BaseAppError('Social account already exists', error_codes_const_1.ErrorCode.BAD_REQUEST, 409);
            }
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw error;
        }
    }
    async findByTenantPlatformAndPage(userId, platform, pageId) {
        const account = await this.repository.findByUserPlatformAndPage(userId, platform, pageId);
        return account ? this.toAccount(account) : null;
    }
    async updateAccountByTenantPlatformAndPage(input) {
        const updated = await this.repository.updateAccountByUserPlatformAndPage(input.userId, input.platform, input.pageId, {
            username: input.username,
            accessToken: input.accessToken,
            connectedDate: input.connectedAt,
            picture: input.picture,
            refreshToken: input.refreshToken,
            expiresIn: input.expiresIn,
            refreshExpiresIn: input.refreshExpiresIn,
            maxVideoPostDurationSec: input.maxVideoPostDurationSec,
            privacyLevelOptions: input.privacyLevelOptions,
        });
        return this.toAccount(updated);
    }
    async findByUserId(userId, workspaceId) {
        const accounts = await this.repository.findByUserId(userId, workspaceId);
        return accounts.map((account) => this.toAccount(account));
    }
    async findByUserIdAndPlatform(userId, platform, workspaceId) {
        const accounts = await this.repository.findByUserIdAndPlatform(userId, platform, workspaceId);
        return accounts.map((account) => this.toAccount(account));
    }
    async getAllAccounts(userId, workspaceId) {
        const accounts = await this.repository.getAllAccounts(userId, workspaceId);
        return accounts.map((account) => this.toAccount(account));
    }
    async updateAccessToken(userId, pageId, newAccessToken) {
        await this.repository.updateAccessToken(userId, pageId, newAccessToken);
    }
    async updateAccessTokenByAccountId(accountId, expiresIn, accessToken, refreshToken, refreshTokenExpiresIn) {
        await this.repository.updateAccessTokenByAccountId(accountId, expiresIn, accessToken, refreshToken, refreshTokenExpiresIn);
    }
    async deleteAccount(userId, accountId) {
        try {
            await this.repository.deleteAccount(userId, accountId);
            return true;
        }
        catch (error) {
            if (error instanceof app_error_1.AppError && error.errorMessageCode === app_error_1.ErrorMessageCode.SOCIAL_ACCOUNT_NOT_FOUND) {
                return false;
            }
            throw error;
        }
    }
    async getAccountById(userId, accountId) {
        const account = await this.repository.getAccountById(userId, accountId);
        return account ? this.toAccount(account) : null;
    }
    async getAccountByUserIdAndSocialAccountId(userId, socialAccountId) {
        const account = await this.repository.getAccountByUserIdAndSocialAccountId(userId, socialAccountId);
        if (!account) {
            throw new base_error_1.BaseAppError('Social account not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        return this.toAccount(account);
    }
    async findAccountsWithExpiringAccessTokens() {
        const snapshots = await this.repository.findAccountsWithExpiringAccessTokens();
        return { accountsSnapshots: snapshots };
    }
    async savePinterestBoard(board) {
        const saved = await this.repository.savePinterestBoard({
            id: board.id,
            userId: board.userId,
            socialAccountId: board.socialAccountId,
            pinterestBoardId: board.pinterestBoardId,
            name: board.name,
            description: board.description ?? null,
            ownerUsername: board.ownerUsername ?? null,
            thumbnailUrl: board.thumbnailUrl ?? null,
            privacy: board.privacy,
            createdAt: board.createdAt,
            updatedAt: board.updatedAt,
        });
        return new pinterest_board_1.PinterestBoard(saved.id, saved.userId, saved.socialAccountId, saved.pinterestBoardId, saved.name, saved.description ?? null, saved.ownerUsername ?? null, saved.thumbnailUrl ?? null, saved.privacy, saved.createdAt, saved.updatedAt);
    }
    async deletePinterestBoardsByAccountId(userId, socialAccountId) {
        await this.repository.deletePinterestBoardsByAccountId(userId, socialAccountId);
    }
    async getPinterestBoards(userId, socialAccountId) {
        const boards = await this.repository.getPinterestBoards(userId, socialAccountId);
        return boards.map((board) => new pinterest_board_1.PinterestBoard(board.id, board.userId, board.socialAccountId, board.pinterestBoardId, board.name, board.description ?? null, board.ownerUsername ?? null, board.thumbnailUrl ?? null, board.privacy, board.createdAt, board.updatedAt));
    }
    toNewSocialAccount(account) {
        return {
            id: account.id,
            userId: account.userId,
            workspaceId: account.workspaceId,
            platform: account.platform,
            username: account.username,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken ?? null,
            picture: account.picture ?? null,
            connectedDate: account.connectedAt ?? null,
            pageId: account.pageId,
            expiresIn: account.expiresIn ?? null,
            refreshExpiresIn: account.refreshExpiresIn ?? null,
            maxVideoPostDurationSec: account.maxVideoPostDurationSec ?? null,
            privacyLevelOptions: account.privacyLevelOptions ?? null,
        };
    }
    toAccount(account) {
        return new account_1.Account(account.id, account.userId, account.workspaceId, account.platform, account.username, account.accessToken, account.connectedDate ?? null, account.pageId, account.picture ?? null, account.refreshToken ?? null, account.expiresIn ?? null, account.refreshExpiresIn ?? null, account.maxVideoPostDurationSec ?? null, account.privacyLevelOptions ?? null);
    }
}
exports.AccountRepository = AccountRepository;
