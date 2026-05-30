import { Request, Response } from 'express'
import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaService } from '../services/media/media-service.interface'
import { IMediaController } from './media-controller.interface'
import { listUserImagesQuerySchema } from '../validation/media.schemas'

export class MediaController implements IMediaController {
    constructor(
        private readonly logger: ILogger,
        private readonly mediaService: IMediaService
    ) {}

    async listUserImages(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id

        const query = listUserImagesQuerySchema.parse(req.query)

        this.logger.info('Received request to list user images', {
            operation: 'listUserImages',
            userId,
            query,
        })

        const result = await this.mediaService.listUserImages(userId, {
            page: query.page,
            limit: query.limit,
            prefix: query.prefix,
            signed: query.signed,
            expiresIn: query.expiresIn,
        })

        res.json(result)
    }
}
