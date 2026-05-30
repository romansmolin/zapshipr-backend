import type { Router } from 'express'
import { Router as createRouter } from 'express'
import multer from 'multer'

import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'

import { WorkspaceController } from '../controllers/workspace.controller'

import type { IWorkspaceService } from '../services/workspace/workspace-service.interface'
import type { IWorkspaceProfileService } from '../services/workspace-profile/workspace-profile.service'
import type { WorkspaceTagsService } from '@/modules/inspiration/services/workspace-tags/workspace-tags.service'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface WorkspaceModuleDeps {
    logger: ILogger
    workspaceService: IWorkspaceService
    workspaceProfileService: IWorkspaceProfileService
    workspaceTagsService: WorkspaceTagsService
}

export interface WorkspaceModule {
    router: Router
}

export const buildWorkspaceModule = ({
    logger,
    workspaceService,
    workspaceProfileService,
    workspaceTagsService,
}: WorkspaceModuleDeps): WorkspaceModule => {
    const router = createRouter()

    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
        },
    })

    const controller = new WorkspaceController(
        workspaceService,
        workspaceTagsService,
        workspaceProfileService,
        logger
    )
    const handler = bindController(controller)

    router.post('/workspaces', authMiddleware, upload.single('avatar'), handler('create'))
    router.get('/workspaces', authMiddleware, handler('getAll'))
    router.get('/workspaces/default', authMiddleware, handler('getDefault'))
    router.get('/workspaces/:id', authMiddleware, handler('getById'))
    router.put('/workspaces/:id', authMiddleware, upload.single('avatar'), handler('update'))
    router.put('/workspaces/:id/default', authMiddleware, handler('setAsDefault'))
    router.delete('/workspaces/:id', authMiddleware, handler('delete'))

    router.get('/workspaces/:id/prompt', authMiddleware, handler('getMainPrompt'))
    router.put('/workspaces/:id/prompt', authMiddleware, handler('updateMainPrompt'))

    router.get('/workspaces/:id/onboarding', authMiddleware, handler('getOnboarding'))
    router.put('/workspaces/:id/onboarding', authMiddleware, handler('updateOnboarding'))

    router.get('/workspaces/:id/ai-context', authMiddleware, handler('getAIContext'))

    router.get('/workspaces/:id/tags', authMiddleware, handler('getTags'))
    router.post('/workspaces/:id/tags', authMiddleware, handler('createTag'))
    router.put('/workspaces/:id/tags/:tagId', authMiddleware, handler('updateTag'))
    router.delete('/workspaces/:id/tags/:tagId', authMiddleware, handler('deleteTag'))

    return { router }
}
