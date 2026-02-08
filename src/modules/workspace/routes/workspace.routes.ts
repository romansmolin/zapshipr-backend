import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import multer from 'multer'

import { schema as dbSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import { asyncHandler } from '@/shared/http/async-handler'
import { authMiddleware } from '@/middleware/auth.middleware'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'

import { WorkspaceRepository } from '../repositories/workspace.repository'
import { WorkspaceProfileSignalsRepository } from '../repositories/workspace-profile-signals.repository'
import { WorkspaceService } from '../services/workspace.service'
import { WorkspaceProfileService } from '../services/workspace-profile.service'
import { WorkspaceController } from '../controllers/workspace.controller'
import { WorkspaceTagsRepository } from '@/modules/inspiration/repositories/workspace-tags.repository'
import { WorkspaceTagsService } from '@/modules/inspiration/services/workspace-tags/workspace-tags.service'

export const createWorkspaceRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
        },
    })

    const repository = new WorkspaceRepository(db, logger)
    const signalsRepository = new WorkspaceProfileSignalsRepository(db, logger)
    const tagsRepository = new WorkspaceTagsRepository(db, logger)
    const tagsService = new WorkspaceTagsService(tagsRepository, logger)
    const mediaUploader = new S3Uploader(logger)
    const profileService = new WorkspaceProfileService(repository, signalsRepository, tagsService, logger)
    const service = new WorkspaceService(repository, mediaUploader, profileService, logger)
    const controller = new WorkspaceController(service, tagsService, profileService, logger)

    router.post('/workspaces', authMiddleware, upload.single('avatar'), asyncHandler(controller.create.bind(controller)))
    router.get('/workspaces', authMiddleware, asyncHandler(controller.getAll.bind(controller)))
    router.get('/workspaces/default', authMiddleware, asyncHandler(controller.getDefault.bind(controller)))
    router.get('/workspaces/:id', authMiddleware, asyncHandler(controller.getById.bind(controller)))
    router.put(
        '/workspaces/:id',
        authMiddleware,
        upload.single('avatar'),
        asyncHandler(controller.update.bind(controller))
    )
    router.put('/workspaces/:id/default', authMiddleware, asyncHandler(controller.setAsDefault.bind(controller)))
    router.delete('/workspaces/:id', authMiddleware, asyncHandler(controller.delete.bind(controller)))

    // Main Prompt endpoints
    router.get('/workspaces/:id/prompt', authMiddleware, asyncHandler(controller.getMainPrompt.bind(controller)))
    router.put(
        '/workspaces/:id/prompt',
        authMiddleware,
        asyncHandler(controller.updateMainPrompt.bind(controller))
    )

    // Onboarding endpoints
    router.get(
        '/workspaces/:id/onboarding',
        authMiddleware,
        asyncHandler(controller.getOnboarding.bind(controller))
    )
    router.put(
        '/workspaces/:id/onboarding',
        authMiddleware,
        asyncHandler(controller.updateOnboarding.bind(controller))
    )

    // AI Context endpoint
    router.get('/workspaces/:id/ai-context', authMiddleware, asyncHandler(controller.getAIContext.bind(controller)))

    // Tags endpoints
    router.get('/workspaces/:id/tags', authMiddleware, asyncHandler(controller.getTags.bind(controller)))
    router.post('/workspaces/:id/tags', authMiddleware, asyncHandler(controller.createTag.bind(controller)))
    router.put('/workspaces/:id/tags/:tagId', authMiddleware, asyncHandler(controller.updateTag.bind(controller)))
    router.delete('/workspaces/:id/tags/:tagId', authMiddleware, asyncHandler(controller.deleteTag.bind(controller)))

    return router
}
