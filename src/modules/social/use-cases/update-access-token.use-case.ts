import type { ILogger } from '@/shared/logger/logger.interface'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface UpdateAccessTokenInput {
    userId: string
    pageId: string
    accessToken: string
}

export type UpdateAccessTokenDeps = {
    accounts: IAccountRepository
    logger: ILogger
}

export const updateAccessToken = async (
    { accounts, logger }: UpdateAccessTokenDeps,
    { userId, pageId, accessToken }: UpdateAccessTokenInput
): Promise<void> => {
    await accounts.updateAccessToken(userId, pageId, accessToken)

    logger.info('Updated social access token', {
        operation: 'updateAccessToken',
        userId,
        pageId,
    })
}
