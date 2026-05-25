import type { Router } from 'express'
import { Router as createRouter } from 'express'

import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'

import { WorkspaceTagsController } from '../controllers/workspace-tags.controller'

import type { WorkspaceTagsService } from '../services/workspace-tags/workspace-tags.service'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface WorkspaceTagsModuleDeps {
    logger: ILogger
    workspaceTagsService: WorkspaceTagsService
}

export interface WorkspaceTagsModule {
    router: Router
}

export const buildWorkspaceTagsModule = ({
    logger,
    workspaceTagsService,
}: WorkspaceTagsModuleDeps): WorkspaceTagsModule => {
    const router = createRouter()
    const controller = new WorkspaceTagsController(workspaceTagsService, logger)
    const handler = bindController(controller)

    router.get('/workspaces/:workspaceId/tags', authMiddleware, handler('getTags'))
    router.post('/workspaces/:workspaceId/tags', authMiddleware, handler('createTag'))
    router.put('/workspaces/:workspaceId/tags/:tagId', authMiddleware, handler('updateTag'))
    router.delete('/workspaces/:workspaceId/tags/:tagId', authMiddleware, handler('deleteTag'))

    return { router }
}
