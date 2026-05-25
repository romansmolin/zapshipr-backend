import { Router as createRouter } from 'express'
import type { Router } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { authMiddleware } from '@/middleware/auth.middleware'
import { bindController } from '@/shared/http/bind-controller'

import { MediaRepository } from '../repositories/media.repository'
import { MediaService } from '../services/media.service'
import { MediaController } from '../controllers/media.controller'

import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader'

export interface MediaModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    mediaUploader: IMediaUploader
}

export interface MediaModule {
    router: Router
}

export const buildMediaModule = ({ db, logger, mediaUploader }: MediaModuleDeps): MediaModule => {
    const router = createRouter()

    const mediaRepository = new MediaRepository(db, logger)
    const mediaService = new MediaService(logger, mediaRepository, mediaUploader)
    const mediaController = new MediaController(logger, mediaService)
    const handler = bindController(mediaController)

    router.get('/media/images', authMiddleware, handler('listUserImages'))

    return { router }
}
