import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'

import { Account } from '@/modules/social/entity/account'
import { PinterestBoard } from '@/modules/social/entity/pinterest-board'
import type { SocialAccount, SocialPlatform } from '@/modules/social/entity/social-account.schema'
import type { SocialTokenSnapshot } from '@/modules/social/entity/social-account.types'
import { SocialAccountsRepository } from '@/modules/social/repositories/social-accounts.repository'

import type { AccountUpdateInput, IAccountRepository } from './account-repository.interface'

export class AccountRepository implements IAccountRepository {
    private readonly repository: SocialAccountsRepository

    constructor(db: NodePgDatabase<typeof dbSchema>, logger: ILogger) {
        this.repository = new SocialAccountsRepository(db, logger)
    }

    async save(account: Account): Promise<Account> {
        try {
            const created = await this.repository.saveAccount(this.toNewSocialAccount(account))
            return this.toAccount(created)
        } catch (error) {
            if (error instanceof AppError && error.errorMessageCode === ErrorMessageCode.SOCIAL_ACCOUNT_ALREADY_EXISTS) {
                throw new BaseAppError('Social account already exists', ErrorCode.BAD_REQUEST, 409)
            }

            if (error instanceof BaseAppError) throw error
            throw error
        }
    }

    async findByTenantPlatformAndPage(
        userId: string,
        platform: SocialPlatform,
        pageId: string
    ): Promise<Account | null> {
        const account = await this.repository.findByUserPlatformAndPage(userId, platform, pageId)
        return account ? this.toAccount(account) : null
    }

    async updateAccountByTenantPlatformAndPage(input: AccountUpdateInput): Promise<Account> {
        const updated = await this.repository.updateAccountByUserPlatformAndPage(
            input.userId,
            input.platform,
            input.pageId,
            {
                username: input.username,
                accessToken: input.accessToken,
                connectedDate: input.connectedAt,
                picture: input.picture,
                refreshToken: input.refreshToken,
                expiresIn: input.expiresIn,
                refreshExpiresIn: input.refreshExpiresIn,
                maxVideoPostDurationSec: input.maxVideoPostDurationSec,
                privacyLevelOptions: input.privacyLevelOptions,
            }
        )

        return this.toAccount(updated)
    }

    async findByUserId(userId: string, workspaceId?: string): Promise<Account[]> {
        const accounts = await this.repository.findByUserId(userId, workspaceId)
        return accounts.map((account) => this.toAccount(account))
    }

    async findByUserIdAndPlatform(userId: string, platform: SocialPlatform, workspaceId?: string): Promise<Account[]> {
        const accounts = await this.repository.findByUserIdAndPlatform(userId, platform, workspaceId)
        return accounts.map((account) => this.toAccount(account))
    }

    async getAllAccounts(userId: string, workspaceId?: string): Promise<Account[]> {
        const accounts = await this.repository.getAllAccounts(userId, workspaceId)
        return accounts.map((account) => this.toAccount(account))
    }

    async updateAccessToken(userId: string, pageId: string, newAccessToken: string): Promise<void> {
        await this.repository.updateAccessToken(userId, pageId, newAccessToken)
    }

    async updateAccessTokenByAccountId(
        accountId: string,
        expiresIn: Date | null,
        accessToken: string,
        refreshToken: string | null,
        refreshTokenExpiresIn: Date | null
    ): Promise<void> {
        await this.repository.updateAccessTokenByAccountId(
            accountId,
            expiresIn,
            accessToken,
            refreshToken,
            refreshTokenExpiresIn
        )
    }

    async deleteAccount(userId: string, accountId: string): Promise<boolean> {
        try {
            await this.repository.deleteAccount(userId, accountId)
            return true
        } catch (error) {
            if (error instanceof AppError && error.errorMessageCode === ErrorMessageCode.SOCIAL_ACCOUNT_NOT_FOUND) {
                return false
            }

            throw error
        }
    }

    async getAccountById(userId: string, accountId: string): Promise<Account | null> {
        const account = await this.repository.getAccountById(userId, accountId)
        return account ? this.toAccount(account) : null
    }

    async getAccountByUserIdAndSocialAccountId(userId: string, socialAccountId: string): Promise<Account> {
        const account = await this.repository.getAccountByUserIdAndSocialAccountId(userId, socialAccountId)

        if (!account) {
            throw new BaseAppError('Social account not found', ErrorCode.NOT_FOUND, 404)
        }

        return this.toAccount(account)
    }

    async findAccountsWithExpiringAccessTokens(): Promise<{ accountsSnapshots: SocialTokenSnapshot[] }> {
        const snapshots = await this.repository.findAccountsWithExpiringAccessTokens()
        return { accountsSnapshots: snapshots }
    }

    async savePinterestBoard(board: PinterestBoard): Promise<PinterestBoard> {
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
        })

        return new PinterestBoard(
            saved.id,
            saved.userId,
            saved.socialAccountId,
            saved.pinterestBoardId,
            saved.name,
            saved.description ?? null,
            saved.ownerUsername ?? null,
            saved.thumbnailUrl ?? null,
            saved.privacy,
            saved.createdAt,
            saved.updatedAt
        )
    }

    async deletePinterestBoardsByAccountId(userId: string, socialAccountId: string): Promise<void> {
        await this.repository.deletePinterestBoardsByAccountId(userId, socialAccountId)
    }

    async getPinterestBoards(userId: string, socialAccountId: string): Promise<PinterestBoard[]> {
        const boards = await this.repository.getPinterestBoards(userId, socialAccountId)

        return boards.map(
            (board) =>
                new PinterestBoard(
                    board.id,
                    board.userId,
                    board.socialAccountId,
                    board.pinterestBoardId,
                    board.name,
                    board.description ?? null,
                    board.ownerUsername ?? null,
                    board.thumbnailUrl ?? null,
                    board.privacy,
                    board.createdAt,
                    board.updatedAt
                )
        )
    }

    private toNewSocialAccount(account: Account) {
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
        }
    }

    private toAccount(account: SocialAccount): Account {
        return new Account(
            account.id,
            account.userId,
            account.workspaceId,
            account.platform,
            account.username,
            account.accessToken,
            account.connectedDate ?? null,
            account.pageId,
            account.picture ?? null,
            account.refreshToken ?? null,
            account.expiresIn ?? null,
            account.refreshExpiresIn ?? null,
            account.maxVideoPostDurationSec ?? null,
            account.privacyLevelOptions ?? null
        )
    }
}
