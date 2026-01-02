import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import { asyncHandler } from '@/shared/http/async-handler'
import { authMiddleware } from '@/middleware/auth.middleware'

import { WorkspaceTagsRepository } from '../repositories/workspace-tags.repository'
import { WorkspaceTagsService } from '../services/workspace-tags/workspace-tags.service'
import { WorkspaceTagsController } from '../controllers/workspace-tags.controller'

export const createWorkspaceTagsRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const repository = new WorkspaceTagsRepository(db, logger)
    const service = new WorkspaceTagsService(repository, logger)
    const controller = new WorkspaceTagsController(service, logger)

    // Workspace Tags endpoints
    router.get(
        '/workspaces/:workspaceId/tags',
        authMiddleware,
        asyncHandler(controller.getTags.bind(controller))
    )
    router.post(
        '/workspaces/:workspaceId/tags',
        authMiddleware,
        asyncHandler(controller.createTag.bind(controller))
    )
    router.put('/workspaces/:workspaceId/tags/:tagId', authMiddleware, asyncHandler(controller.updateTag.bind(controller)))
    router.delete(
        '/workspaces/:workspaceId/tags/:tagId',
        authMiddleware,
        asyncHandler(controller.deleteTag.bind(controller))
    )

    return router
}

