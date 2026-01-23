import { and, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'

import {
    pinterestBoards,
    socialAccounts,
    type NewPinterestBoard,
    type NewSocialAccount,
    type PinterestBoard,
    type SocialAccount,
    type SocialPlatform,
} from '../entity/social-account.schema'
import type { SocialTokenSnapshot } from '../entity/social-account.types'
import type { ISocialAccountsRepository, SocialAccountUpdateInput } from './social-accounts-repository.interface'
import { decryptNullableToken, decryptToken, encryptNullableToken, encryptToken } from '../utils/token-encryption'

const LONG_REFRESH_PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'threads', 'pinterest']
const SHORT_REFRESH_PLATFORMS: SocialPlatform[] = ['tiktok', 'youtube', 'x']

const DAYS_10_IN_MS = 10 * 24 * 60 * 60 * 1000
const MINUTES_5_IN_MS = 5 * 60 * 1000
const MINUTES_15_IN_MS = 15 * 60 * 1000

const isDuplicateKeyError = (error: unknown): boolean => {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
    )
}

export class SocialAccountsRepository implements ISocialAccountsRepository {
    private readonly db: NodePgDatabase<typeof dbSchema>
    private readonly logger: ILogger

    constructor(db: NodePgDatabase<typeof dbSchema>, logger: ILogger) {
        this.db = db
        this.logger = logger
    }

    async saveAccount(account: NewSocialAccount): Promise<SocialAccount> {
        try {
            const values = this.buildInsertValues(account)

            const created = await this.db.transaction(async (tx) => {
                const [row] = await tx.insert(socialAccounts).values(values).returning()
                return row
            })

            return this.mapRowToAccount(created)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                this.logger.warn('Social account already exists', {
                    operation: 'SocialAccountsRepository.saveAccount',
                    entity: 'social_accounts',
                    error: formatError(error),
                })
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.SOCIAL_ACCOUNT_ALREADY_EXISTS,
                    httpCode: 409,
                })
            }

            this.logger.error('Failed to save social account', {
                operation: 'SocialAccountsRepository.saveAccount',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async findByUserPlatformAndPage(
        userId: string,
        platform: SocialPlatform,
        pageId: string
    ): Promise<SocialAccount | null> {
        try {
            const [account] = await this.db
                .select()
                .from(socialAccounts)
                .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform), eq(socialAccounts.pageId, pageId)))
                .limit(1)

            return account ? this.mapRowToAccount(account) : null
        } catch (error) {
            this.logger.error('Failed to fetch social account by user/platform/page', {
                operation: 'SocialAccountsRepository.findByUserPlatformAndPage',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async updateAccountByUserPlatformAndPage(
        userId: string,
        platform: SocialPlatform,
        pageId: string,
        updates: SocialAccountUpdateInput
    ): Promise<SocialAccount> {
        try {
            const values = this.buildUpdateValues(updates)

            const updated = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .update(socialAccounts)
                    .set(values)
                    .where(
                        and(
                            eq(socialAccounts.userId, userId),
                            eq(socialAccounts.platform, platform),
                            eq(socialAccounts.pageId, pageId)
                        )
                    )
                    .returning()

                return row
            })

            if (!updated) {
                throw this.buildNotFoundError()
            }

            return this.mapRowToAccount(updated)
        } catch (error) {
            if (error instanceof AppError) throw error

            this.logger.error('Failed to update social account by user/platform/page', {
                operation: 'SocialAccountsRepository.updateAccountByUserPlatformAndPage',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async findByUserId(userId: string, workspaceId?: string): Promise<SocialAccount[]> {
        try {
            const conditions = [eq(socialAccounts.userId, userId)]
            
            if (workspaceId) {
                conditions.push(eq(socialAccounts.workspaceId, workspaceId))
            }

            const rows = await this.db
                .select()
                .from(socialAccounts)
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
            return rows.map((row) => this.mapRowToAccount(row))
        } catch (error) {
            this.logger.error('Failed to fetch social accounts by user', {
                operation: 'SocialAccountsRepository.findByUserId',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async findByUserIdAndPlatform(userId: string, platform: SocialPlatform, workspaceId?: string): Promise<SocialAccount[]> {
        try {
            const conditions = [eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform)]
            
            if (workspaceId) {
                conditions.push(eq(socialAccounts.workspaceId, workspaceId))
            }

            const rows = await this.db
                .select()
                .from(socialAccounts)
                .where(and(...conditions))
            return rows.map((row) => this.mapRowToAccount(row))
        } catch (error) {
            this.logger.error('Failed to fetch social accounts by user and platform', {
                operation: 'SocialAccountsRepository.findByUserIdAndPlatform',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async getAllAccounts(userId: string, workspaceId?: string): Promise<SocialAccount[]> {
        return this.findByUserId(userId, workspaceId)
    }

    async updateAccessToken(userId: string, pageId: string, newAccessToken: string): Promise<void> {
        try {
            const encryptedToken = encryptToken(newAccessToken)

            const updated = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .update(socialAccounts)
                    .set({ accessToken: encryptedToken })
                    .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.pageId, pageId)))
                    .returning({ id: socialAccounts.id })

                return row
            })

            if (!updated) {
                throw this.buildNotFoundError()
            }
        } catch (error) {
            if (error instanceof AppError) throw error

            this.logger.error('Failed to update social access token', {
                operation: 'SocialAccountsRepository.updateAccessToken',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async updateAccessTokenByAccountId(
        accountId: string,
        expiresIn: Date | null,
        accessToken: string,
        refreshToken: string | null,
        refreshTokenExpiresIn: Date | null
    ): Promise<void> {
        try {
            const updated = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .update(socialAccounts)
                    .set({
                        accessToken: encryptToken(accessToken),
                        refreshToken: encryptNullableToken(refreshToken),
                        expiresIn,
                        refreshExpiresIn: refreshTokenExpiresIn,
                    })
                    .where(eq(socialAccounts.id, accountId))
                    .returning({ id: socialAccounts.id })

                return row
            })

            if (!updated) {
                throw this.buildNotFoundError()
            }
        } catch (error) {
            if (error instanceof AppError) throw error

            this.logger.error('Failed to update social access token by account', {
                operation: 'SocialAccountsRepository.updateAccessTokenByAccountId',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async deleteAccount(userId: string, accountId: string): Promise<void> {
        try {
            const deleted = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .delete(socialAccounts)
                    .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.id, accountId)))
                    .returning({ id: socialAccounts.id })

                return row
            })

            if (!deleted) {
                throw this.buildNotFoundError()
            }
        } catch (error) {
            if (error instanceof AppError) throw error

            this.logger.error('Failed to delete social account', {
                operation: 'SocialAccountsRepository.deleteAccount',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async getAccountById(userId: string, accountId: string): Promise<SocialAccount | null> {
        try {
            const [account] = await this.db
                .select()
                .from(socialAccounts)
                .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.id, accountId)))
                .limit(1)

            return account ? this.mapRowToAccount(account) : null
        } catch (error) {
            this.logger.error('Failed to fetch social account by id', {
                operation: 'SocialAccountsRepository.getAccountById',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async getAccountByUserIdAndSocialAccountId(
        userId: string,
        socialAccountId: string
    ): Promise<SocialAccount | null> {
        return this.getAccountById(userId, socialAccountId)
    }

    async findAccountsWithExpiringAccessTokens(): Promise<SocialTokenSnapshot[]> {
        try {
            const now = new Date()
            const longWindow = new Date(now.getTime() + DAYS_10_IN_MS)
            const shortWindow = new Date(now.getTime() + MINUTES_5_IN_MS)
            const blueskyWindow = new Date(now.getTime() + MINUTES_15_IN_MS)

            const rows = await this.db
                .select({
                    id: socialAccounts.id,
                    platform: socialAccounts.platform,
                    accessToken: socialAccounts.accessToken,
                    refreshToken: socialAccounts.refreshToken,
                    expiresIn: socialAccounts.expiresIn,
                })
                .from(socialAccounts)
                .where(
                    or(
                        and(
                            inArray(socialAccounts.platform, LONG_REFRESH_PLATFORMS),
                            lt(socialAccounts.expiresIn, longWindow)
                        ),
                        and(
                            inArray(socialAccounts.platform, SHORT_REFRESH_PLATFORMS),
                            lt(socialAccounts.expiresIn, shortWindow)
                        ),
                        and(
                            eq(socialAccounts.platform, 'bluesky'),
                            or(isNull(socialAccounts.expiresIn), lt(socialAccounts.expiresIn, blueskyWindow))
                        )
                    )
                )

            return rows.map((row) => ({
                id: row.id,
                platform: row.platform,
                accessToken: decryptToken(row.accessToken),
                refreshToken: decryptNullableToken(row.refreshToken),
            }))
        } catch (error) {
            this.logger.error('Failed to fetch accounts with expiring access tokens', {
                operation: 'SocialAccountsRepository.findAccountsWithExpiringAccessTokens',
                entity: 'social_accounts',
                error: formatError(error),
            })
            throw error
        }
    }

    async savePinterestBoard(board: NewPinterestBoard): Promise<PinterestBoard> {
        try {
            const values = this.normalizePinterestBoard(board)

            const saved = await this.db.transaction(async (tx) => {
                const [row] = await tx
                    .insert(pinterestBoards)
                    .values(values)
                    .onConflictDoUpdate({
                        target: [pinterestBoards.userId, pinterestBoards.pinterestBoardId],
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
                    .returning()

                return row
            })

            return this.normalizePinterestBoard(saved)
        } catch (error) {
            this.logger.error('Failed to save Pinterest board', {
                operation: 'SocialAccountsRepository.savePinterestBoard',
                entity: 'pinterest_boards',
                error: formatError(error),
            })
            throw error
        }
    }

    async deletePinterestBoardsByAccountId(userId: string, socialAccountId: string): Promise<void> {
        try {
            await this.db.transaction(async (tx) => {
                await tx
                    .delete(pinterestBoards)
                    .where(
                        and(
                            eq(pinterestBoards.userId, userId),
                            eq(pinterestBoards.socialAccountId, socialAccountId)
                        )
                    )
            })
        } catch (error) {
            this.logger.error('Failed to delete Pinterest boards', {
                operation: 'SocialAccountsRepository.deletePinterestBoardsByAccountId',
                entity: 'pinterest_boards',
                error: formatError(error),
            })
            throw error
        }
    }

    async getPinterestBoards(userId: string, workspaceId: string, socialAccountId: string): Promise<PinterestBoard[]> {
        try {
            const rows = await this.db
                .select()
                .from(pinterestBoards)
                .innerJoin(socialAccounts, eq(pinterestBoards.socialAccountId, socialAccounts.id))
                .where(
                    and(
                        eq(pinterestBoards.userId, userId),
                        eq(socialAccounts.workspaceId, workspaceId),
                        eq(pinterestBoards.socialAccountId, socialAccountId),
                        ne(pinterestBoards.privacy, 'SECRET')
                    )
                )

            return rows.map((row) => this.normalizePinterestBoard(row.pinterest_boards))
        } catch (error) {
            this.logger.error('Failed to fetch Pinterest boards', {
                operation: 'SocialAccountsRepository.getPinterestBoards',
                entity: 'pinterest_boards',
                error: formatError(error),
            })
            throw error
        }
    }

    private buildInsertValues(account: NewSocialAccount): NewSocialAccount {
        return {
            ...account,
            accessToken: encryptToken(account.accessToken),
            refreshToken: encryptNullableToken(account.refreshToken),
            picture: account.picture ?? null,
        }
    }

    private buildUpdateValues(updates: SocialAccountUpdateInput): Partial<NewSocialAccount> {
        const values: Partial<NewSocialAccount> = {}

        if (updates.username !== undefined) values.username = updates.username
        if (updates.accessToken !== undefined) values.accessToken = encryptToken(updates.accessToken)
        if (updates.refreshToken !== undefined) values.refreshToken = encryptNullableToken(updates.refreshToken)
        if (updates.picture !== undefined) values.picture = updates.picture
        if (updates.connectedDate !== undefined) values.connectedDate = updates.connectedDate
        if (updates.expiresIn !== undefined) values.expiresIn = updates.expiresIn
        if (updates.refreshExpiresIn !== undefined) values.refreshExpiresIn = updates.refreshExpiresIn
        if (updates.maxVideoPostDurationSec !== undefined)
            values.maxVideoPostDurationSec = updates.maxVideoPostDurationSec
        if (updates.privacyLevelOptions !== undefined) values.privacyLevelOptions = updates.privacyLevelOptions

        return values
    }

    private mapRowToAccount(account: SocialAccount): SocialAccount {
        return {
            ...account,
            accessToken: decryptToken(account.accessToken),
            refreshToken: decryptNullableToken(account.refreshToken),
            picture: account.picture ?? null,
            connectedDate: account.connectedDate ?? null,
            expiresIn: account.expiresIn ?? null,
            refreshExpiresIn: account.refreshExpiresIn ?? null,
            maxVideoPostDurationSec: account.maxVideoPostDurationSec ?? null,
            privacyLevelOptions: account.privacyLevelOptions ?? null,
        }
    }

    private normalizePinterestBoard(board: PinterestBoard): PinterestBoard
    private normalizePinterestBoard(board: NewPinterestBoard): NewPinterestBoard
    private normalizePinterestBoard(board: PinterestBoard | NewPinterestBoard) {
        return {
            ...board,
            description: board.description ?? null,
            ownerUsername: board.ownerUsername ?? null,
            thumbnailUrl: board.thumbnailUrl ?? null,
        }
    }

    private buildNotFoundError() {
        return new AppError({
            errorMessageCode: ErrorMessageCode.SOCIAL_ACCOUNT_NOT_FOUND,
            httpCode: 404,
        })
    }
}
