import type { ILogger } from '@/shared/logger/logger.interface'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface UpdateAccessTokenByIdInput {
    accountId: string
    accessToken: string
    refreshToken: string | null
    expiresIn: Date | null
    refreshTokenExpiresIn: Date | null
}

export type UpdateAccessTokenByIdDeps = {
    accounts: IAccountRepository
    logger: ILogger
}

export const updateAccessTokenById = async (
    { accounts, logger }: UpdateAccessTokenByIdDeps,
    { accountId, accessToken, refreshToken, expiresIn, refreshTokenExpiresIn }: UpdateAccessTokenByIdInput
): Promise<void> => {
    await accounts.updateAccessTokenByAccountId(
        accountId,
        expiresIn,
        accessToken,
        refreshToken,
        refreshTokenExpiresIn
    )

    logger.info('Updated social access token by account', {
        operation: 'updateAccessTokenById',
        accountId,
    })
}
