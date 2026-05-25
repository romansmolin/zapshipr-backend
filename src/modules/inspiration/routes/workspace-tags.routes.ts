import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'

import { WorkspaceTagsRepository } from '../repositories/workspace-tags.repository'
import { WorkspaceTagsService } from '../services/workspace-tags/workspace-tags.service'
import { WorkspaceTagsController } from '../controllers/workspace-tags.controller'

import type { ILogger } from '@/shared/logger/logger.interface'

export interface WorkspaceTagsModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
}

export interface WorkspaceTagsModule {
    router: Router
}

export const buildWorkspaceTagsModule = ({ db, logger }: WorkspaceTagsModuleDeps): WorkspaceTagsModule => {
    const router = createRouter()

    const repository = new WorkspaceTagsRepository(db, logger)
    const service = new WorkspaceTagsService(repository, logger)
    const controller = new WorkspaceTagsController(service, logger)
    const handler = bindController(controller)

    router.get('/workspaces/:workspaceId/tags', authMiddleware, handler('getTags'))
    router.post('/workspaces/:workspaceId/tags', authMiddleware, handler('createTag'))
    router.put('/workspaces/:workspaceId/tags/:tagId', authMiddleware, handler('updateTag'))
    router.delete('/workspaces/:workspaceId/tags/:tagId', authMiddleware, handler('deleteTag'))

    return { router }
}
