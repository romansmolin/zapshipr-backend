import type { ILogger } from '@/shared/logger/logger.interface'

import type { SocialTokenSnapshot } from '@/modules/social/entity/social-account.types'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export class FindExpiringAccountsUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger

    constructor(repo: IAccountRepository, logger: ILogger) {
        this.repo = repo
        this.logger = logger
    }

    async execute(): Promise<SocialTokenSnapshot[]> {
        const { accountsSnapshots } = await this.repo.findAccountsWithExpiringAccessTokens()

        this.logger.info('Fetched accounts with expiring tokens', {
            operation: 'FindExpiringAccountsUseCase.execute',
            count: accountsSnapshots.length,
        })

        return accountsSnapshots
    }
}
