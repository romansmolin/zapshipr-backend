"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const app_error_1 = require("@/shared/errors/app-error");
const forma_error_1 = require("@/shared/utils/forma-error");
const user_schema_1 = require("../entity/user.schema");
const isDuplicateKeyError = (error) => {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505');
};
class UserRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async findByEmail(email) {
        try {
            const [user] = await this.db.select().from(user_schema_1.users).where((0, drizzle_orm_1.eq)(user_schema_1.users.email, email)).limit(1);
            return user ? this.mapUserRow(user) : null;
        }
        catch (error) {
            this.logger.error('Failed to fetch user by email', {
                operation: 'UserRepository.findByEmail',
                entity: 'users',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async findById(id) {
        try {
            const [user] = await this.db.select().from(user_schema_1.users).where((0, drizzle_orm_1.eq)(user_schema_1.users.id, id)).limit(1);
            return user ? this.mapUserRow(user) : null;
        }
        catch (error) {
            this.logger.error('Failed to fetch user by id', {
                operation: 'UserRepository.findById',
                entity: 'users',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async createUser(user) {
        try {
            const [createdUser] = await this.db.insert(user_schema_1.users).values(user).returning();
            return this.mapUserRow(createdUser);
        }
        catch (error) {
            if (isDuplicateKeyError(error)) {
                this.logger.warn('User already exists', {
                    operation: 'UserRepository.createUser',
                    entity: 'users',
                    error: (0, forma_error_1.formatError)(error),
                });
                throw new app_error_1.AppError({
                    errorMessageCode: app_error_1.ErrorMessageCode.USER_ALREADY_EXISTS,
                    httpCode: 409,
                });
            }
            this.logger.error('Failed to create user', {
                operation: 'UserRepository.createUser',
                entity: 'users',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async updateRefreshToken(userId, refreshToken) {
        try {
            await this.db.update(user_schema_1.users).set({ refreshToken }).where((0, drizzle_orm_1.eq)(user_schema_1.users.id, userId));
        }
        catch (error) {
            this.logger.error('Failed to update refresh token', {
                operation: 'UserRepository.updateRefreshToken',
                entity: 'users',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async updateUserPassword(userId, passwordHash) {
        try {
            await this.db.update(user_schema_1.users).set({ passwordHash }).where((0, drizzle_orm_1.eq)(user_schema_1.users.id, userId));
        }
        catch (error) {
            this.logger.error('Failed to update user password', {
                operation: 'UserRepository.updateUserPassword',
                entity: 'users',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async getUserPlanName(userId) {
        try {
            const result = await this.db.execute((0, drizzle_orm_1.sql) `SELECT plan_name FROM user_plans WHERE user_id = ${userId} AND is_active = true ORDER BY created_at DESC LIMIT 1`);
            return result.rows[0]?.plan_name ?? null;
        }
        catch (error) {
            this.logger.error('Failed to fetch user plan name', {
                operation: 'UserRepository.getUserPlanName',
                entity: 'user_plans',
                userId,
                error: (0, forma_error_1.formatError)(error),
            });
            // Return null instead of throwing to allow users without plans
            return null;
        }
    }
    mapUserRow(user) {
        return {
            ...user,
            passwordHash: user.passwordHash ?? null,
            avatar: user.avatar ?? null,
            refreshToken: user.refreshToken ?? null,
            stripeCustomerId: user.stripeCustomerId ?? null,
        };
    }
}
exports.UserRepository = UserRepository;
