import type { ILogger } from '@/shared/logger/logger.interface'

import { toAccountResponse, type SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface ListAccountsInput {
    userId: string
    workspaceId?: string
}

export type ListAccountsDeps = {
    accounts: IAccountRepository
    logger: ILogger
}

export const listAccounts = async (
    { accounts, logger }: ListAccountsDeps,
    { userId, workspaceId }: ListAccountsInput
): Promise<SocialAccountResponse[]> => {
    const items = workspaceId
        ? await accounts.getAllAccounts(userId, workspaceId)
        : await accounts.findByUserId(userId)

    logger.info('Fetched social accounts', {
        operation: 'listAccounts',
        userId,
        workspaceId: workspaceId ?? 'all',
        count: items.length,
    })

    return items.map((account) => toAccountResponse(account as any))
}
