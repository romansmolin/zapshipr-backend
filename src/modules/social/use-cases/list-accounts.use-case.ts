import type { ILogger } from '@/shared/logger/logger.interface'

import { toAccountResponse, type SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface ListAccountsInput {
    userId: string
}

export class ListAccountsUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger

    constructor(repo: IAccountRepository, logger: ILogger) {
        this.repo = repo
        this.logger = logger
    }

    async execute({ userId }: ListAccountsInput): Promise<SocialAccountResponse[]> {
        const accounts = await this.repo.getAllAccounts(userId)

        this.logger.info('Fetched social accounts', {
            operation: 'ListAccountsUseCase.execute',
            userId,
            count: accounts.length,
        })

        return accounts.map((account) => toAccountResponse(account as any))
    }
}
