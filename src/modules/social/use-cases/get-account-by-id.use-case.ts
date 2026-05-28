import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'

import { toAccountResponse, type SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface GetAccountByIdInput {
    userId: string
    accountId: string
}

export type GetAccountByIdDeps = {
    accounts: IAccountRepository
    logger: ILogger
}

export const getAccountById = async (
    { accounts, logger }: GetAccountByIdDeps,
    { userId, accountId }: GetAccountByIdInput
): Promise<SocialAccountResponse> => {
    const account = await accounts.getAccountById(userId, accountId)

    if (!account) {
        throw new BaseAppError('Social account not found', ErrorCode.NOT_FOUND, 404)
    }

    logger.info('Fetched social account', {
        operation: 'getAccountById',
        userId,
        accountId,
    })

    return toAccountResponse(account as any)
}
