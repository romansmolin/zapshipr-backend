"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialAccountsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const app_error_1 = require("@/shared/errors/app-error");
const forma_error_1 = require("@/shared/utils/forma-error");
const social_account_schema_1 = require("../entity/social-account.schema");
const token_encryption_1 = require("../utils/token-encryption");
const LONG_REFRESH_PLATFORMS = ['facebook', 'instagram', 'threads', 'pinterest'];
const SHORT_REFRESH_PLATFORMS = ['tiktok', 'youtube', 'x'];
const DAYS_10_IN_MS = 10 * 24 * 60 * 60 * 1000;
const MINUTES_5_IN_MS = 5 * 60 * 1000;
const MINUTES_15_IN_MS = 15 * 60 * 1000;
const isDuplicateKeyError = (error) => {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505');
};
class SocialAccountsRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async saveAccount(account) {
        try {
            const values = this.buildInsertValues(account);
            const created = await this.db.transaction(async (tx) => {
                const [row] = await tx.insert(social_account_schema_1.socialAccounts).values(values).returning();
                return row;
            });
            return this.mapRowToAccount(created);
        }
        catch (error) {
            if (isDuplicateKeyError(error)) {
                this.logger.warn('Social account already exists', {
                    operation: 'SocialAccountsRepository.saveAccount',
                    entity: 'social_accounts',
                    error: (0, forma_error_1.formatError)(error),
                });
                throw new app_error_1.AppError({
                    errorMessageCode: app_error_1.ErrorMessageCode.SOCIAL_ACCOUNT_ALREADY_EXISTS,
                    httpCode: 409,
                });
            }
            this.logger.error('Failed to save social account', {
                operation: 'SocialAccountsRepository.saveAccount',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async findByUserPlatformAndPage(userId, platform, pageId) {
        try {
            const [account] = await this.db
                .select()
                .from(social_account_schema_1.socialAccounts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.platform, platform), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.pageId, pageId)))
                .limit(1);
            return account ? this.mapRowToAccount(account) : null;
        }
        catch (error) {
            this.logger.error('Failed to fetch social account by user/platform/page', {
                operation: 'SocialAccountsRepository.findByUserPlatformAndPage',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async updateAccountByUserPlatformAndPage(userId, platform, pageId, updates) {
        try {
            const values = this.buildUpdateValues(updates);
            const updated = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .update(social_account_schema_1.socialAccounts)
                    .set(values)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.platform, platform), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.pageId, pageId)))
                    .returning();
                return row;
            });
            if (!updated) {
                throw this.buildNotFoundError();
            }
            return this.mapRowToAccount(updated);
        }
        catch (error) {
            if (error instanceof app_error_1.AppError)
                throw error;
            this.logger.error('Failed to update social account by user/platform/page', {
                operation: 'SocialAccountsRepository.updateAccountByUserPlatformAndPage',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async findByUserId(userId, workspaceId) {
        try {
            const conditions = [(0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.userId, userId)];
            if (workspaceId) {
                conditions.push((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.workspaceId, workspaceId));
            }
            const rows = await this.db
                .select()
                .from(social_account_schema_1.socialAccounts)
                .where(conditions.length === 1 ? conditions[0] : (0, drizzle_orm_1.and)(...conditions));
            return rows.map((row) => this.mapRowToAccount(row));
        }
        catch (error) {
            this.logger.error('Failed to fetch social accounts by user', {
                operation: 'SocialAccountsRepository.findByUserId',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async findByUserIdAndPlatform(userId, platform, workspaceId) {
        try {
            const conditions = [(0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.platform, platform)];
            if (workspaceId) {
                conditions.push((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.workspaceId, workspaceId));
            }
            const rows = await this.db
                .select()
                .from(social_account_schema_1.socialAccounts)
                .where((0, drizzle_orm_1.and)(...conditions));
            return rows.map((row) => this.mapRowToAccount(row));
        }
        catch (error) {
            this.logger.error('Failed to fetch social accounts by user and platform', {
                operation: 'SocialAccountsRepository.findByUserIdAndPlatform',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async getAllAccounts(userId, workspaceId) {
        return this.findByUserId(userId, workspaceId);
    }
    async updateAccessToken(userId, pageId, newAccessToken) {
        try {
            const encryptedToken = (0, token_encryption_1.encryptToken)(newAccessToken);
            const updated = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .update(social_account_schema_1.socialAccounts)
                    .set({ accessToken: encryptedToken })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.pageId, pageId)))
                    .returning({ id: social_account_schema_1.socialAccounts.id });
                return row;
            });
            if (!updated) {
                throw this.buildNotFoundError();
            }
        }
        catch (error) {
            if (error instanceof app_error_1.AppError)
                throw error;
            this.logger.error('Failed to update social access token', {
                operation: 'SocialAccountsRepository.updateAccessToken',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async updateAccessTokenByAccountId(accountId, expiresIn, accessToken, refreshToken, refreshTokenExpiresIn) {
        try {
            const updated = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .update(social_account_schema_1.socialAccounts)
                    .set({
                    accessToken: (0, token_encryption_1.encryptToken)(accessToken),
                    refreshToken: (0, token_encryption_1.encryptNullableToken)(refreshToken),
                    expiresIn,
                    refreshExpiresIn: refreshTokenExpiresIn,
                })
                    .where((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.id, accountId))
                    .returning({ id: social_account_schema_1.socialAccounts.id });
                return row;
            });
            if (!updated) {
                throw this.buildNotFoundError();
            }
        }
        catch (error) {
            if (error instanceof app_error_1.AppError)
                throw error;
            this.logger.error('Failed to update social access token by account', {
                operation: 'SocialAccountsRepository.updateAccessTokenByAccountId',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async deleteAccount(userId, accountId) {
        try {
            const deleted = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .delete(social_account_schema_1.socialAccounts)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.id, accountId)))
                    .returning({ id: social_account_schema_1.socialAccounts.id });
                return row;
            });
            if (!deleted) {
                throw this.buildNotFoundError();
            }
        }
        catch (error) {
            if (error instanceof app_error_1.AppError)
                throw error;
            this.logger.error('Failed to delete social account', {
                operation: 'SocialAccountsRepository.deleteAccount',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async getAccountById(userId, accountId) {
        try {
            const [account] = await this.db
                .select()
                .from(social_account_schema_1.socialAccounts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.id, accountId)))
                .limit(1);
            return account ? this.mapRowToAccount(account) : null;
        }
        catch (error) {
            this.logger.error('Failed to fetch social account by id', {
                operation: 'SocialAccountsRepository.getAccountById',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async getAccountByUserIdAndSocialAccountId(userId, socialAccountId) {
        return this.getAccountById(userId, socialAccountId);
    }
    async findAccountsWithExpiringAccessTokens() {
        try {
            const now = new Date();
            const longWindow = new Date(now.getTime() + DAYS_10_IN_MS);
            const shortWindow = new Date(now.getTime() + MINUTES_5_IN_MS);
            const blueskyWindow = new Date(now.getTime() + MINUTES_15_IN_MS);
            const rows = await this.db
                .select({
                id: social_account_schema_1.socialAccounts.id,
                platform: social_account_schema_1.socialAccounts.platform,
                accessToken: social_account_schema_1.socialAccounts.accessToken,
                refreshToken: social_account_schema_1.socialAccounts.refreshToken,
                expiresIn: social_account_schema_1.socialAccounts.expiresIn,
            })
                .from(social_account_schema_1.socialAccounts)
                .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(social_account_schema_1.socialAccounts.platform, LONG_REFRESH_PLATFORMS), (0, drizzle_orm_1.lt)(social_account_schema_1.socialAccounts.expiresIn, longWindow)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(social_account_schema_1.socialAccounts.platform, SHORT_REFRESH_PLATFORMS), (0, drizzle_orm_1.lt)(social_account_schema_1.socialAccounts.expiresIn, shortWindow)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.socialAccounts.platform, 'bluesky'), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(social_account_schema_1.socialAccounts.expiresIn), (0, drizzle_orm_1.lt)(social_account_schema_1.socialAccounts.expiresIn, blueskyWindow)))));
            return rows.map((row) => ({
                id: row.id,
                platform: row.platform,
                accessToken: (0, token_encryption_1.decryptToken)(row.accessToken),
                refreshToken: (0, token_encryption_1.decryptNullableToken)(row.refreshToken),
            }));
        }
        catch (error) {
            this.logger.error('Failed to fetch accounts with expiring access tokens', {
                operation: 'SocialAccountsRepository.findAccountsWithExpiringAccessTokens',
                entity: 'social_accounts',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async savePinterestBoard(board) {
        try {
            const values = this.normalizePinterestBoard(board);
            const saved = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .insert(social_account_schema_1.pinterestBoards)
                    .values(values)
                    .onConflictDoUpdate({
                    target: [social_account_schema_1.pinterestBoards.userId, social_account_schema_1.pinterestBoards.pinterestBoardId],
                    set: {
                        socialAccountId: values.socialAccountId,
                        name: values.name,
                        description: values.description,
                        ownerUsername: values.ownerUsername,
                        thumbnailUrl: values.thumbnailUrl,
                        privacy: values.privacy,
                        updatedAt: new Date(),
                    },
                })
                    .returning();
                return row;
            });
            return this.normalizePinterestBoard(saved);
        }
        catch (error) {
            this.logger.error('Failed to save Pinterest board', {
                operation: 'SocialAccountsRepository.savePinterestBoard',
                entity: 'pinterest_boards',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async deletePinterestBoardsByAccountId(userId, socialAccountId) {
        try {
            await this.db.transaction(async (tx) => {
                await tx
                    .delete(social_account_schema_1.pinterestBoards)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.pinterestBoards.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.pinterestBoards.socialAccountId, socialAccountId)));
            });
        }
        catch (error) {
            this.logger.error('Failed to delete Pinterest boards', {
                operation: 'SocialAccountsRepository.deletePinterestBoardsByAccountId',
                entity: 'pinterest_boards',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async getPinterestBoards(userId, socialAccountId) {
        try {
            const rows = await this.db
                .select()
                .from(social_account_schema_1.pinterestBoards)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(social_account_schema_1.pinterestBoards.userId, userId), (0, drizzle_orm_1.eq)(social_account_schema_1.pinterestBoards.socialAccountId, socialAccountId), (0, drizzle_orm_1.ne)(social_account_schema_1.pinterestBoards.privacy, 'SECRET')));
            return rows.map((row) => this.normalizePinterestBoard(row));
        }
        catch (error) {
            this.logger.error('Failed to fetch Pinterest boards', {
                operation: 'SocialAccountsRepository.getPinterestBoards',
                entity: 'pinterest_boards',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    buildInsertValues(account) {
        return {
            ...account,
            accessToken: (0, token_encryption_1.encryptToken)(account.accessToken),
            refreshToken: (0, token_encryption_1.encryptNullableToken)(account.refreshToken),
            picture: account.picture ?? null,
        };
    }
    buildUpdateValues(updates) {
        const values = {};
        if (updates.username !== undefined)
            values.username = updates.username;
        if (updates.accessToken !== undefined)
            values.accessToken = (0, token_encryption_1.encryptToken)(updates.accessToken);
        if (updates.refreshToken !== undefined)
            values.refreshToken = (0, token_encryption_1.encryptNullableToken)(updates.refreshToken);
        if (updates.picture !== undefined)
            values.picture = updates.picture;
        if (updates.connectedDate !== undefined)
            values.connectedDate = updates.connectedDate;
        if (updates.expiresIn !== undefined)
            values.expiresIn = updates.expiresIn;
        if (updates.refreshExpiresIn !== undefined)
            values.refreshExpiresIn = updates.refreshExpiresIn;
        if (updates.maxVideoPostDurationSec !== undefined)
            values.maxVideoPostDurationSec = updates.maxVideoPostDurationSec;
        if (updates.privacyLevelOptions !== undefined)
            values.privacyLevelOptions = updates.privacyLevelOptions;
        return values;
    }
    mapRowToAccount(account) {
        return {
            ...account,
            accessToken: (0, token_encryption_1.decryptToken)(account.accessToken),
            refreshToken: (0, token_encryption_1.decryptNullableToken)(account.refreshToken),
            picture: account.picture ?? null,
            connectedDate: account.connectedDate ?? null,
            expiresIn: account.expiresIn ?? null,
            refreshExpiresIn: account.refreshExpiresIn ?? null,
            maxVideoPostDurationSec: account.maxVideoPostDurationSec ?? null,
            privacyLevelOptions: account.privacyLevelOptions ?? null,
        };
    }
    normalizePinterestBoard(board) {
        return {
            ...board,
            description: board.description ?? null,
            ownerUsername: board.ownerUsername ?? null,
            thumbnailUrl: board.thumbnailUrl ?? null,
        };
    }
    buildNotFoundError() {
        return new app_error_1.AppError({
            errorMessageCode: app_error_1.ErrorMessageCode.SOCIAL_ACCOUNT_NOT_FOUND,
            httpCode: 404,
        });
    }
}
exports.SocialAccountsRepository = SocialAccountsRepository;
