import type { NextFunction, Request, Response } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { DBSchema } from '@/db/schema'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository'
import { workspaceIdParamSchema } from '@/modules/workspace/validation/workspace.schemas'

declare global {
    namespace Express {
        interface Request {
            workspaceId?: string
        }
    }
}

export const createWorkspaceMiddleware = (logger: ILogger, db: NodePgDatabase<DBSchema>) => {
    const workspaceRepository = new WorkspaceRepository(db, logger)

    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        const userId = req.user?.id

        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const parseResult = workspaceIdParamSchema.safeParse(req.params)

        if (!parseResult.success) {
            throw new BaseAppError('Invalid workspace ID', ErrorCode.BAD_REQUEST, 400)
        }

        const { workspaceId } = parseResult.data

        const workspace = await workspaceRepository.findByIdAndUserId(workspaceId, userId)

        if (!workspace) {
            throw new BaseAppError('Workspace not found or access denied', ErrorCode.NOT_FOUND, 404)
        }

        req.workspaceId = workspaceId

        next()
    }
}
