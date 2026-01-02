"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetPinterestBoardsUseCase = void 0;
class GetPinterestBoardsUseCase {
    constructor(repo, logger) {
        this.repo = repo;
        this.logger = logger;
    }
    async execute({ userId, socialAccountId }) {
        const boards = await this.repo.getPinterestBoards(userId, socialAccountId);
        this.logger.info('Fetched Pinterest boards', {
            operation: 'GetPinterestBoardsUseCase.execute',
            userId,
            socialAccountId,
            count: boards.length,
        });
        return boards;
    }
}
exports.GetPinterestBoardsUseCase = GetPinterestBoardsUseCase;
