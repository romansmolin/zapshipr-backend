import { Router } from 'express'
import { ILogger } from '@/shared/logger/logger.interface'
import { asyncHandler } from '@/shared/http/async-handler'
import { authMiddleware } from '@/middleware/auth.middleware'
import { S3Uploader } from '@/shared/media-uploader/media-uploader'
import { MediaService } from '../services/media.service'
import { MediaController } from '../controllers/media.controller'

export const createMediaRouter = (logger: ILogger): Router => {
    const router = Router()

    // Initialize dependencies
    const mediaUploader = new S3Uploader(logger)
    const mediaService = new MediaService(logger, mediaUploader)
    const mediaController = new MediaController(logger, mediaService)

    router.get(
        '/media/images',
        authMiddleware,
        asyncHandler(async (req, res) => mediaController.listUserImages(req, res))
    )

    return router
}
