import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import multer from 'multer'

import { schema as dbSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import { asyncHandler } from '@/shared/http/async-handler'
import { authMiddleware } from '@/middleware/auth.middleware'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'
import { BullMqInspirationScheduler } from '@/shared/queue'

import { InspirationsRepository } from '../repositories/inspirations.repository'
import { InspirationsService } from '../services/inspirations.service'
import { InspirationsController } from '../controllers/inspirations.controller'

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
})

export const createInspirationsRouter = (logger: ILogger, db: NodePgDatabase<typeof dbSchema>): Router => {
    const router = createRouter()

    const repository = new InspirationsRepository(db, logger)
    const mediaUploader = new S3Uploader(logger)
    const scheduler = new BullMqInspirationScheduler()
    const service = new InspirationsService(repository, mediaUploader, scheduler, logger)
    const controller = new InspirationsController(service, logger)

    router.post(
        '/workspaces/:workspaceId/inspirations',
        authMiddleware,
        upload.single('file'),
        asyncHandler(controller.create.bind(controller))
    )
    router.get(
        '/workspaces/:workspaceId/inspirations',
        authMiddleware,
        asyncHandler(controller.getAll.bind(controller))
    )
    router.get(
        '/workspaces/:workspaceId/inspirations/:id',
        authMiddleware,
        asyncHandler(controller.getById.bind(controller))
    )
    router.put(
        '/workspaces/:workspaceId/inspirations/:id',
        authMiddleware,
        asyncHandler(controller.update.bind(controller))
    )
    router.delete(
        '/workspaces/:workspaceId/inspirations/:id',
        authMiddleware,
        asyncHandler(controller.delete.bind(controller))
    )
    router.post(
        '/workspaces/:workspaceId/inspirations/:id/retry',
        authMiddleware,
        asyncHandler(controller.retry.bind(controller))
    )
    router.post(
        '/workspaces/:workspaceId/inspirations/:id/extract',
        authMiddleware,
        asyncHandler(controller.triggerExtraction.bind(controller))
    )

    return router
}
