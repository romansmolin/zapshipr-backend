import { ListUserImagesResponse } from '../../entity/media.dto'

export interface ListUserImagesOptions {
    page: number
    limit: number
    prefix?: string
    signed: boolean
    expiresIn: number
}

export interface IMediaService {
    listUserImages(userId: string, options: ListUserImagesOptions): Promise<ListUserImagesResponse>
}
