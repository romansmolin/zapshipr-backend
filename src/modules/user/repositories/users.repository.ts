import { randomUUID } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { UserPlans } from '@/shared/consts/plans'
import { formatError } from '@/shared/utils/forma-error'

import { users } from '../entity/user.schema'
import type { IUserRepository, UserPlanRow } from './user-repository.interface'
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

    async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
        try {
            const [user] = await this.db
                .select()
                .from(users)
                .where(eq(users.stripeCustomerId, stripeCustomerId))
                .limit(1)

            return user ? this.mapUserRow(user) : null
        } catch (error) {
            this.logger.error('Failed to fetch user by stripe customer id', {
                operation: 'UserRepository.findByStripeCustomerId',
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

    async updateUserProfile(
        userId: string,
        data: { name?: string; email?: string; avatar?: string | null }
    ): Promise<User> {
        try {
            const [updatedUser] = await this.db
                .update(users)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, userId))
                .returning()

            if (!updatedUser) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
                    httpCode: 404,
                })
            }

            return this.mapUserRow(updatedUser)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.USER_ALREADY_EXISTS,
                    httpCode: 409,
                })
            }

            this.logger.error('Failed to update user profile', {
                operation: 'UserRepository.updateUserProfile',
                entity: 'users',
                userId,
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

    async deleteById(userId: string): Promise<void> {
        try {
            await this.db.delete(users).where(eq(users.id, userId))

            this.logger.info('User deleted successfully', {
                operation: 'UserRepository.deleteById',
                entity: 'users',
                userId,
            })
        } catch (error) {
            this.logger.error('Failed to delete user', {
                operation: 'UserRepository.deleteById',
                entity: 'users',
                userId,
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

    async findActivePlan(userId: string): Promise<UserPlanRow | null> {
        try {
            const result = await this.db.execute(sql`
                SELECT
                    id,
                    plan_name,
                    billing_status,
                    plan_type,
                    start_date,
                    current_period_end,
                    end_date
                FROM user_plans
                WHERE user_id = ${userId}
                  AND coalesce(is_active, true) = true
                ORDER BY created_at DESC
                LIMIT 1
            `)

            const row = result.rows[0] as
                | {
                      id: string
                      plan_name: string
                      billing_status: string | null
                      plan_type: 'yearly' | 'monthly'
                      start_date: Date | string
                      current_period_end: Date | string | null
                      end_date: Date | string | null
                  }
                | undefined

            if (!row) return null

            return {
                id: row.id,
                planName: row.plan_name,
                billingStatus: row.billing_status,
                planType: row.plan_type,
                startDate: this.toDate(row.start_date, new Date()) ?? new Date(),
                currentPeriodEnd: this.toDate(row.current_period_end, null),
                endDate: this.toDate(row.end_date, null),
            }
        } catch (error) {
            this.logger.error('Failed to fetch active plan', {
                operation: 'UserRepository.findActivePlan',
                entity: 'user_plans',
                userId,
                error: formatError(error),
            })
            throw error
        }
    }

    async findLastPlan(userId: string): Promise<UserPlanRow | null> {
        try {
            const result = await this.db.execute(sql`
                SELECT
                    id,
                    plan_name,
                    billing_status,
                    plan_type,
                    start_date,
                    current_period_end,
                    end_date
                FROM user_plans
                WHERE user_id = ${userId}
                ORDER BY created_at DESC
                LIMIT 1
            `)

            const row = result.rows[0] as
                | {
                      id: string
                      plan_name: string
                      billing_status: string | null
                      plan_type: 'yearly' | 'monthly'
                      start_date: Date | string
                      current_period_end: Date | string | null
                      end_date: Date | string | null
                  }
                | undefined

            if (!row) return null

            return {
                id: row.id,
                planName: row.plan_name,
                billingStatus: row.billing_status,
                planType: row.plan_type,
                startDate: this.toDate(row.start_date, new Date()) ?? new Date(),
                currentPeriodEnd: this.toDate(row.current_period_end, null),
                endDate: this.toDate(row.end_date, null),
            }
        } catch (error) {
            this.logger.error('Failed to fetch last plan', {
                operation: 'UserRepository.findLastPlan',
                entity: 'user_plans',
                userId,
                error: formatError(error),
            })
            throw error
        }
    }

    async getAiUsageCount(userId: string, planId: string, periodStart: Date, periodEnd: Date): Promise<number> {
        try {
            const result = await this.db.execute(sql`
                SELECT used_count
                FROM user_plan_usage
                WHERE user_id = ${userId}
                  AND plan_id = ${planId}
                  AND usage_type = 'ai'
                  AND period_start = ${periodStart}
                  AND period_end = ${periodEnd}
                ORDER BY created_at DESC
                LIMIT 1
            `)

            const row = result.rows[0] as { used_count: number | string } | undefined
            return Number(row?.used_count ?? 0)
        } catch (error) {
            this.logger.error('Failed to fetch AI usage count', {
                operation: 'UserRepository.getAiUsageCount',
                entity: 'user_plan_usage',
                userId,
                error: formatError(error),
            })
            throw error
        }
    }

    async getPostMediaUsage(userId: string): Promise<{ files: number; storageBytes: number }> {
        try {
            const result = await this.db.execute(sql`
                SELECT
                    count(DISTINCT ma.id)::int AS files,
                    coalesce(sum(coalesce(ma.size_bytes, 0)), 0)::bigint AS storage_bytes
                FROM media_assets ma
                INNER JOIN post_media_assets pma ON pma.media_asset_id = ma.id
                INNER JOIN posts p ON p.id = pma.post_id
                WHERE p.user_id = ${userId}
            `)

            const row = result.rows[0] as { files: number | string; storage_bytes: number | string } | undefined

            return {
                files: Number(row?.files ?? 0),
                storageBytes: Number(row?.storage_bytes ?? 0),
            }
        } catch (error) {
            this.logger.error('Failed to fetch post media usage', {
                operation: 'UserRepository.getPostMediaUsage',
                entity: 'media_assets',
                userId,
                error: formatError(error),
            })
            throw error
        }
    }

    private toDate(value: Date | string | null | undefined, fallback: Date | null): Date | null {
        if (!value) return fallback
        if (value instanceof Date) return value

        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) {
            return fallback
        }

        return parsed
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
