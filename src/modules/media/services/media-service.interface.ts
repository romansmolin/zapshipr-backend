import { ListUserImagesResponse } from '../entity/media.dto'

export interface ListUserImagesOptions {
    limit: number
    cursor?: string
    prefix?: string
    signed: boolean
    expiresIn: number
}

export interface IMediaService {
    listUserImages(userId: string, options: ListUserImagesOptions): Promise<ListUserImagesResponse>
}
