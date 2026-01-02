import type { ILogger } from '@/shared/logger/logger.interface'

import type { PinterestBoard } from '@/modules/social/entity/pinterest-board'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface GetPinterestBoardsInput {
    userId: string
    socialAccountId: string
}

export class GetPinterestBoardsUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger

    constructor(repo: IAccountRepository, logger: ILogger) {
        this.repo = repo
        this.logger = logger
    }

    async execute({ userId, socialAccountId }: GetPinterestBoardsInput): Promise<PinterestBoard[]> {
        const boards = await this.repo.getPinterestBoards(userId, socialAccountId)

        this.logger.info('Fetched Pinterest boards', {
            operation: 'GetPinterestBoardsUseCase.execute',
            userId,
            socialAccountId,
            count: boards.length,
        })

        return boards
    }
}
