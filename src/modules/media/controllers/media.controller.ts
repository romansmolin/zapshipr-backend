import { Request, Response } from 'express'
import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaService } from '../services/media-service.interface'
import { IMediaController } from './media-controller.interface'
import { listUserImagesQuerySchema } from '../validation/media.schemas'

export class MediaController implements IMediaController {
    constructor(
        private readonly logger: ILogger,
        private readonly mediaService: IMediaService
    ) {}

    async listUserImages(req: Request, res: Response): Promise<void> {
        // Extract userId from authenticated request
        const userId = req.user!.id

        // Validate query parameters
        const query = listUserImagesQuerySchema.parse(req.query)

        this.logger.info('Received request to list user images', {
            operation: 'listUserImages',
            userId,
            query,
        })

        // Call service
        const result = await this.mediaService.listUserImages(userId, {
            limit: query.limit,
            cursor: query.cursor,
            prefix: query.prefix,
            signed: query.signed,
            expiresIn: query.expiresIn,
        })

        res.json(result)
    }
}
