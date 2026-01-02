import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IUserService } from '@/modules/user/services/user.service.interface'

import { Account } from '@/modules/social/entity/account'
import { toAccountResponse, type SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface ConnectAccountInput {
    account: Account
}

export interface ConnectAccountResult {
    isNew: boolean
    account: SocialAccountResponse
}

export class ConnectAccountUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger
    private readonly userService?: IUserService

    constructor(repo: IAccountRepository, logger: ILogger, userService?: IUserService) {
        this.repo = repo
        this.logger = logger
        this.userService = userService
    }

    async execute({ account }: ConnectAccountInput): Promise<ConnectAccountResult> {
        const existing = await this.repo.findByTenantPlatformAndPage(
            account.userId,
            account.platform,
            account.pageId
        )

        if (existing) {
            const updated = await this.repo.updateAccountByTenantPlatformAndPage({
                userId: account.userId,
                platform: account.platform,
                pageId: account.pageId,
                username: account.username,
                accessToken: account.accessToken,
                connectedAt: account.connectedAt ?? new Date(),
                picture: account.picture ?? null,
                refreshToken: account.refreshToken ?? null,
                expiresIn: account.expiresIn ?? null,
                refreshExpiresIn: account.refreshExpiresIn ?? null,
                maxVideoPostDurationSec: account.maxVideoPostDurationSec ?? null,
                privacyLevelOptions: account.privacyLevelOptions ?? null,
            })

            return {
                isNew: false,
                account: toAccountResponse(updated as any),
            }
        }

        if (this.userService) {
            const usage = await this.userService.getUsageQuota(account.userId)
            const { used, limit } = usage.connectedAccounts

            if (used >= limit) {
                throw new BaseAppError(
                    'Account limit reached for the current plan',
                    ErrorCode.PLAN_LIMIT_REACHED,
                    403
                )
            }
        }

        const created = await this.repo.save(account)

        if (this.userService) {
            await this.userService.incrementConnectedAccountsUsage(account.userId)
        }

        this.logger.info('Social account connected', {
            operation: 'ConnectAccountUseCase.execute',
            userId: account.userId,
            platform: account.platform,
            pageId: account.pageId,
        })

        return {
            isNew: true,
            account: toAccountResponse(created as any),
        }
    }
}
