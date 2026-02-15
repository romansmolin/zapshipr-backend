import type { UserMedia, InsertUserMedia } from '../entity/user-media.schema'

export interface PostMediaRecord {
    url: string
    contentType: string | null
    lastModified: Date
}

export interface IMediaRepository {
    create(data: InsertUserMedia): Promise<UserMedia>
    findByKey(key: string): Promise<UserMedia | undefined>
    findByUserId(userId: string, options: {
        limit: number
        offset: number
        prefix?: string
    }): Promise<UserMedia[]>
    countByUserId(userId: string, prefix?: string): Promise<number>
    findPostMediaByUserId(userId: string): Promise<PostMediaRecord[]>
    deleteByKey(key: string): Promise<void>
    deleteByUserId(userId: string): Promise<void>
}
