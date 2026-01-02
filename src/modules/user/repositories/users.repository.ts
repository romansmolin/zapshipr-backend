import { eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'

import { users } from '../entity/user.schema'
import type { IUserRepository } from './user-repository.interface'
import type { NewUser, User } from '../entity/user.schema'

const isDuplicateKeyError = (error: unknown): boolean => {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
    )
}

export class UserRepository implements IUserRepository {
    private readonly db: NodePgDatabase<typeof dbSchema>
    private readonly logger: ILogger

    constructor(db: NodePgDatabase<typeof dbSchema>, logger: ILogger) {
        this.db = db
        this.logger = logger
    }

    async findByEmail(email: string): Promise<User | null> {
        try {
            const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1)

            return user ? this.mapUserRow(user) : null
        } catch (error) {
            this.logger.error('Failed to fetch user by email', {
                operation: 'UserRepository.findByEmail',
                entity: 'users',
                error: formatError(error),
            })
            throw error
        }
    }

    async findById(id: string): Promise<User | null> {
        try {
            const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)

            return user ? this.mapUserRow(user) : null
        } catch (error) {
            this.logger.error('Failed to fetch user by id', {
                operation: 'UserRepository.findById',
                entity: 'users',
                error: formatError(error),
            })
            throw error
        }
    }

    async createUser(user: NewUser): Promise<User> {
        try {
            const [createdUser] = await this.db.insert(users).values(user).returning()
            return this.mapUserRow(createdUser)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                this.logger.warn('User already exists', {
                    operation: 'UserRepository.createUser',
                    entity: 'users',
                    error: formatError(error),
                })
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.USER_ALREADY_EXISTS,
                    httpCode: 409,
                })
            }

            this.logger.error('Failed to create user', {
                operation: 'UserRepository.createUser',
                entity: 'users',
                error: formatError(error),
            })
            throw error
        }
    }

    async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
        try {
            await this.db.update(users).set({ refreshToken }).where(eq(users.id, userId))
        } catch (error) {
            this.logger.error('Failed to update refresh token', {
                operation: 'UserRepository.updateRefreshToken',
                entity: 'users',
                error: formatError(error),
            })
            throw error
        }
    }

    async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
        try {
            await this.db.update(users).set({ passwordHash }).where(eq(users.id, userId))
        } catch (error) {
            this.logger.error('Failed to update user password', {
                operation: 'UserRepository.updateUserPassword',
                entity: 'users',
                error: formatError(error),
            })
            throw error
        }
    }

    async getUserPlanName(userId: string): Promise<string | null> {
        try {
            const result = await this.db.execute(
                sql`SELECT plan_name FROM user_plans WHERE user_id = ${userId} AND is_active = true ORDER BY created_at DESC LIMIT 1`
            )

            return (result.rows[0] as { plan_name: string } | undefined)?.plan_name ?? null
        } catch (error) {
            this.logger.error('Failed to fetch user plan name', {
                operation: 'UserRepository.getUserPlanName',
                entity: 'user_plans',
                userId,
                error: formatError(error),
            })
            // Return null instead of throwing to allow users without plans
            return null
        }
    }

    private mapUserRow(user: User): User {
        return {
            ...user,
            passwordHash: user.passwordHash ?? null,
            avatar: user.avatar ?? null,
            refreshToken: user.refreshToken ?? null,
            stripeCustomerId: user.stripeCustomerId ?? null,
        }
    }
}
