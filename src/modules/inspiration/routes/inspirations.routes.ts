import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import multer from 'multer'

import { schema as dbSchema } from '@/db/schema'
import { asyncHandler } from '@/shared/http/async-handler'
import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'
import { createWorkspaceMiddleware } from '@/middleware/workspace.middleware'
import { BullMqInspirationScheduler } from '@/shared/queue'

import { InspirationsRepository } from '../repositories/inspirations.repository'
import { InspirationsService } from '../services/inspirations.service'
import { InspirationsController } from '../controllers/inspirations.controller'
import { ContentParserService } from '../services/content-parser/content-parser.service'

import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader'

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
})

export interface InspirationsModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    mediaUploader: IMediaUploader
}

export interface InspirationsModule {
    router: Router
}

export const buildInspirationsModule = ({ db, logger, mediaUploader }: InspirationsModuleDeps): InspirationsModule => {
    const router = createRouter()

    const repository = new InspirationsRepository(db, logger)
    const scheduler = new BullMqInspirationScheduler()
    const contentParser = new ContentParserService(logger)
    const service = new InspirationsService(repository, mediaUploader, scheduler, contentParser, logger)
    const controller = new InspirationsController(service, logger)
    const workspaceMiddleware = createWorkspaceMiddleware(logger, db)
    const handler = bindController(controller)

    router.post(
        '/workspaces/:workspaceId/inspirations',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        upload.single('file'),
        handler('create')
    )
    router.get(
        '/workspaces/:workspaceId/inspirations',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('getAll')
    )
    router.get(
        '/workspaces/:workspaceId/inspirations/:id',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('getById')
    )
    router.put(
        '/workspaces/:workspaceId/inspirations/:id',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('update')
    )
    router.delete(
        '/workspaces/:workspaceId/inspirations/:id',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('delete')
    )
    router.post(
        '/workspaces/:workspaceId/inspirations/:id/retry',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('retry')
    )
    router.post(
        '/workspaces/:workspaceId/inspirations/:id/extract',
        authMiddleware,
        asyncHandler(workspaceMiddleware),
        handler('triggerExtraction')
    )

    return { router }
}
