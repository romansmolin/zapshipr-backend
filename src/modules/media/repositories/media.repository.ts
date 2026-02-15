import { eq, and, desc, like, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { DBSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger'

import type { InsertUserMedia, UserMedia } from '../entity/user-media.schema'
import { userMedia } from '../entity/user-media.schema'
import type { IMediaRepository } from './media-repository.interface'
import { mediaAssets, postMediaAssets, posts } from '@/modules/post/entity/post.schema'

export class MediaRepository implements IMediaRepository {
    constructor(
        private db: NodePgDatabase<DBSchema>,
        private logger: ILogger
    ) {}

    async create(data: InsertUserMedia): Promise<UserMedia> {
        this.logger.info('Creating user media record', { key: data.key, userId: data.userId })

        const [media] = await this.db
            .insert(userMedia)
            .values({
                ...data,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: userMedia.key,
                set: {
                    size: data.size,
                    lastModified: data.lastModified,
                    updatedAt: new Date(),
                },
            })
            .returning()

        this.logger.info('User media record created/updated', { id: media.id })

        return media
    }

    async findByKey(key: string): Promise<UserMedia | undefined> {
        this.logger.info('Finding media by key', { key })

        const [media] = await this.db.select().from(userMedia).where(eq(userMedia.key, key))

        return media
    }

    async findByUserId(
        userId: string,
        options: {
            limit: number
            offset: number
            prefix?: string
        }
    ): Promise<UserMedia[]> {
        this.logger.info('Finding media by user id', { userId, ...options })

        const conditions = [eq(userMedia.userId, userId)]

        if (options.prefix) {
            const fullPrefix = `${userId}/${options.prefix}`
            conditions.push(like(userMedia.key, `${fullPrefix}%`))
        }

        const media = await this.db
            .select()
            .from(userMedia)
            .where(and(...conditions))
            .orderBy(userMedia.lastModified)
            .limit(options.limit)
            .offset(options.offset)

        return media
    }

    async countByUserId(userId: string, prefix?: string): Promise<number> {
        this.logger.info('Counting media by user id', { userId, prefix })

        const conditions = [eq(userMedia.userId, userId)]

        if (prefix) {
            const fullPrefix = `${userId}/${prefix}`
            conditions.push(like(userMedia.key, `${fullPrefix}%`))
        }

        const [result] = await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(userMedia)
            .where(and(...conditions))

        return result?.count ?? 0
    }

    async findPostMediaByUserId(userId: string): Promise<Array<{ url: string; contentType: string | null; lastModified: Date }>> {
        this.logger.info('Finding post-linked media by user id', { userId })

        const rows = await this.db
            .select({
                url: mediaAssets.url,
                contentType: mediaAssets.type,
                lastModified: mediaAssets.uploadedAt,
            })
            .from(mediaAssets)
            .innerJoin(postMediaAssets, eq(postMediaAssets.mediaAssetId, mediaAssets.id))
            .innerJoin(posts, eq(posts.id, postMediaAssets.postId))
            .where(and(eq(posts.userId, userId), like(mediaAssets.type, 'image/%')))
            .orderBy(desc(mediaAssets.uploadedAt))

        return rows
    }

    async deleteByKey(key: string): Promise<void> {
        this.logger.info('Deleting media by key', { key })

        await this.db.delete(userMedia).where(eq(userMedia.key, key))
    }

    async deleteByUserId(userId: string): Promise<void> {
        this.logger.info('Deleting all media for user', { userId })

        await this.db.delete(userMedia).where(eq(userMedia.userId, userId))
    }
}
