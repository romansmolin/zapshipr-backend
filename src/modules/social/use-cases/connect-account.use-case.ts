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

export type ConnectAccountDeps = {
    accounts: IAccountRepository
    userService: IUserService
    logger: ILogger
}

export const connectAccount = async (
    { accounts, userService, logger }: ConnectAccountDeps,
    { account }: ConnectAccountInput
): Promise<ConnectAccountResult> => {
    const existing = await accounts.findByTenantPlatformAndPage(
        account.userId,
        account.platform,
        account.pageId
    )

    if (existing) {
        if (existing.workspaceId && account.workspaceId && existing.workspaceId !== account.workspaceId) {
            logger.warn('Account already connected to a different workspace', {
                operation: 'connectAccount',
                userId: account.userId,
                platform: account.platform,
                pageId: account.pageId,
                existingWorkspaceId: existing.workspaceId,
                requestedWorkspaceId: account.workspaceId,
            })

            throw new BaseAppError(
                'This social account is already connected to a different workspace',
                ErrorCode.WORKSPACE_MISMATCH,
                409
            )
        }

        const updated = await accounts.updateAccountByTenantPlatformAndPage({
            userId: account.userId,
            workspaceId: account.workspaceId,
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

    await userService.assertCanConnectAccount(account.userId)

    const created = await accounts.save(account)

    logger.info('Social account connected', {
        operation: 'connectAccount',
        userId: account.userId,
        platform: account.platform,
        pageId: account.pageId,
    })

    return {
        isNew: true,
        account: toAccountResponse(created as any),
    }
}
