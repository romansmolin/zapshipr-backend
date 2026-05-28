import type { ILogger } from '@/shared/logger/logger.interface'

import type { PinterestBoard } from '@/modules/social/entity/pinterest-board'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'

export interface GetPinterestBoardsInput {
    userId: string
    workspaceId: string
    socialAccountId: string
}

export type GetPinterestBoardsDeps = {
    accounts: IAccountRepository
    logger: ILogger
}

export const getPinterestBoards = async (
    { accounts, logger }: GetPinterestBoardsDeps,
    { userId, workspaceId, socialAccountId }: GetPinterestBoardsInput
): Promise<PinterestBoard[]> => {
    const boards = await accounts.getPinterestBoards(userId, workspaceId, socialAccountId)

    logger.info('Fetched Pinterest boards', {
        operation: 'getPinterestBoards',
        userId,
        workspaceId,
        socialAccountId,
        count: boards.length,
    })

    return boards
}
