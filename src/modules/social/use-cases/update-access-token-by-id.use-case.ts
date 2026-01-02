import type { ILogger } from '@/shared/logger/logger.interface'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface UpdateAccessTokenByIdInput {
    accountId: string
    accessToken: string
    refreshToken: string | null
    expiresIn: Date | null
    refreshTokenExpiresIn: Date | null
}

export class UpdateAccessTokenByIdUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger

    constructor(repo: IAccountRepository, logger: ILogger) {
        this.repo = repo
        this.logger = logger
    }

    async execute({
        accountId,
        accessToken,
        refreshToken,
        expiresIn,
        refreshTokenExpiresIn,
    }: UpdateAccessTokenByIdInput): Promise<void> {
        await this.repo.updateAccessTokenByAccountId(
            accountId,
            expiresIn,
            accessToken,
            refreshToken,
            refreshTokenExpiresIn
        )

        this.logger.info('Updated social access token by account', {
            operation: 'UpdateAccessTokenByIdUseCase.execute',
            accountId,
        })
    }
}
