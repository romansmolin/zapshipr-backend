import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'

import { toAccountResponse, type SocialAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface GetAccountByIdInput {
    userId: string
    accountId: string
}

export class GetAccountByIdUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger

    constructor(repo: IAccountRepository, logger: ILogger) {
        this.repo = repo
        this.logger = logger
    }

    async execute({ userId, accountId }: GetAccountByIdInput): Promise<SocialAccountResponse> {
        const account = await this.repo.getAccountById(userId, accountId)

        if (!account) {
            throw new BaseAppError('Social account not found', ErrorCode.NOT_FOUND, 404)
        }

        this.logger.info('Fetched social account', {
            operation: 'GetAccountByIdUseCase.execute',
            userId,
            accountId,
        })

        return toAccountResponse(account as any)
    }
}
