import { Request, Response } from 'express'

export interface IMediaController {
    listUserImages(req: Request, res: Response): Promise<void>
}
