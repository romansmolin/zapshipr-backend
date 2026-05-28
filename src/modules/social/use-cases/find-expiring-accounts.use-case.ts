import type { ILogger } from '@/shared/logger/logger.interface'

import type { SocialTokenSnapshot } from '@/modules/social/entity/social-account.types'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export type FindExpiringAccountsDeps = {
    accounts: IAccountRepository
    logger: ILogger
}

export const findExpiringAccounts = async ({
    accounts,
    logger,
}: FindExpiringAccountsDeps): Promise<SocialTokenSnapshot[]> => {
    const { accountsSnapshots } = await accounts.findAccountsWithExpiringAccessTokens()

    logger.info('Fetched accounts with expiring tokens', {
        operation: 'findExpiringAccounts',
        count: accountsSnapshots.length,
    })

    return accountsSnapshots
}
