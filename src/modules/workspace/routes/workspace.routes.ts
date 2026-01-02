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
import { WorkspaceService } from '../services/workspace.service'
import { WorkspaceController } from '../controllers/workspace.controller'

const upload = multer({ storage: multer.memoryStorage() })

export const createWorkspaceRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const repository = new WorkspaceRepository(db, logger)
    const mediaUploader = new S3Uploader(logger)
    const service = new WorkspaceService(repository, mediaUploader, logger)
    const controller = new WorkspaceController(service, logger)

    router.post('/workspaces', authMiddleware, asyncHandler(controller.create.bind(controller)))
    router.get('/workspaces', authMiddleware, asyncHandler(controller.getAll.bind(controller)))
    router.get('/workspaces/default', authMiddleware, asyncHandler(controller.getDefault.bind(controller)))
    router.get('/workspaces/:id', authMiddleware, asyncHandler(controller.getById.bind(controller)))
    router.put('/workspaces/:id', authMiddleware, asyncHandler(controller.update.bind(controller)))
    router.put('/workspaces/:id/default', authMiddleware, asyncHandler(controller.setAsDefault.bind(controller)))
    router.delete('/workspaces/:id', authMiddleware, asyncHandler(controller.delete.bind(controller)))
    router.post(
        '/workspaces/:id/avatar',
        authMiddleware,
        upload.single('avatar'),
        asyncHandler(controller.updateAvatar.bind(controller))
    )
    
    // Main Prompt endpoints
    router.get('/workspaces/:id/prompt', authMiddleware, asyncHandler(controller.getMainPrompt.bind(controller)))
    router.put('/workspaces/:id/prompt', authMiddleware, asyncHandler(controller.updateMainPrompt.bind(controller)))

    return router
}


