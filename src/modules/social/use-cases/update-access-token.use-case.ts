import type { ILogger } from '@/shared/logger/logger.interface'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface UpdateAccessTokenInput {
    userId: string
    pageId: string
    accessToken: string
}

export class UpdateAccessTokenUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger

    constructor(repo: IAccountRepository, logger: ILogger) {
        this.repo = repo
        this.logger = logger
    }

    async execute({ userId, pageId, accessToken }: UpdateAccessTokenInput): Promise<void> {
        await this.repo.updateAccessToken(userId, pageId, accessToken)

        this.logger.info('Updated social access token', {
            operation: 'UpdateAccessTokenUseCase.execute',
            userId,
            pageId,
        })
    }
}
