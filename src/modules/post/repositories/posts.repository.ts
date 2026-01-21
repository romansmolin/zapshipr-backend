import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { v4 as uuidv4 } from 'uuid'

import { schema as dbSchema } from '@/db/schema'
import { PostTargetEntity } from '@/modules/post/entity/post-target'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import { formatError } from '@/shared/utils/forma-error'
import { PostStatus } from '@/modules/post/types/posts.types'

import { toPostMediaAsset, toPostTargetResponse } from '../entity/post.mappers'
import { mediaAssets, postMediaAssets, postTargets, posts } from '../entity/post.schema'

import type { IPostsRepository } from './posts-repository.interface'
import type { PostType } from '@/modules/post/schemas/posts.schemas'
import type { ILogger } from '@/shared/logger/logger.interface'
import type {
    CreatePostResponse,
    PostFilters,
    PostMediaAsset,
    PostTarget,
    PostTargetResponse,
    PostsByDateResponse,
    PostsListResponse,
} from '@/modules/post/types/posts.types'

export class PostsRepository implements IPostsRepository {
    private readonly db: NodePgDatabase<typeof dbSchema>
    private readonly logger: ILogger

    constructor(db: NodePgDatabase<typeof dbSchema>, logger: ILogger) {
        this.db = db
        this.logger = logger
    }

    async createBasePost(
        userId: string,
        workspaceId: string,
        status: PostStatus,
        postType: PostType,
        scheduledTime: Date | null,
        mainCaption?: string | null,
        coverTimestamp?: number | null,
        coverImageUrl?: string | null
    ): Promise<{ postId: string }> {
        try {
            const postId = uuidv4()
            await this.db.insert(posts).values({
                id: postId,
                userId,
                workspaceId,
                status,
                type: postType,
                scheduledTime,
                mainCaption: mainCaption ?? null,
                coverTimestamp: coverTimestamp ?? null,
                coverImageUrl: coverImageUrl ?? null,
            })

            return { postId }
        } catch (error) {
            this.logger.error('Failed to create base post', {
                operation: 'PostsRepository.createBasePost',
                userId,
                workspaceId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to create post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async savePostMediaAssets(data: { userId: string; url: string; type: string }): Promise<{ mediaId: string }> {
        try {
            const mediaId = uuidv4()

            await this.db.insert(mediaAssets).values({
                id: mediaId,
                userId: data.userId,
                url: data.url,
                type: data.type,
            })

            return { mediaId }
        } catch (error) {
            this.logger.error('Failed to save media asset', {
                operation: 'PostsRepository.savePostMediaAssets',
                userId: data.userId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to save media asset', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async createPostMediaAssetRelation(postId: string, mediaId: string, order: number): Promise<void> {
        try {
            await this.db.insert(postMediaAssets).values({
                postId,
                mediaAssetId: mediaId,
                order,
            })
        } catch (error) {
            this.logger.error('Failed to create post media relation', {
                operation: 'PostsRepository.createPostMediaAssetRelation',
                postId,
                mediaId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to create post media relation', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async createPostTargets(targets: PostTarget[]): Promise<void> {
        try {
            await this.db.transaction(async (tx) => {
                if (targets.length === 0) return

                await tx.insert(postTargets).values(
                    targets.map((target) => ({
                        postId: target.postId,
                        socialAccountId: target.socialAccountId,
                        platform: target.platform,
                        text: target.text ?? null,
                        title: target.title ?? null,
                        pinterestBoardId: target.pinterestBoardId ?? null,
                        tags: target.tags ?? [],
                        links: target.links ?? [],
                        isAutoMusicEnabled: target.isAutoMusicEnabled ?? false,
                        instagramLocationId: target.instagramLocationId ?? null,
                        instagramFacebookPageId: target.instagramFacebookPageId ?? null,
                        threadsReplies: target.threadsReplies ?? [],
                        tikTokPostPrivacyLevel: target.tikTokPostPrivacyLevel ?? null,
                    }))
                )
            })
        } catch (error) {
            this.logger.error('Failed to create post targets', {
                operation: 'PostsRepository.createPostTargets',
                error: formatError(error),
            })
            throw new BaseAppError('Failed to create post targets', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostDetails(postId: string, userId: string): Promise<CreatePostResponse> {
        try {
            const [post] = await this.db
                .select()
                .from(posts)
                .where(and(eq(posts.id, postId.trim()), eq(posts.userId, userId.trim())))
                .limit(1)

            if (!post) {
                throw new BaseAppError('Post not found', ErrorCode.NOT_FOUND, 404)
            }

            const mediaAssetsRows = await this.getPostMediaAssets(postId)
            const targetRows = await this.db.select().from(postTargets).where(eq(postTargets.postId, postId))

            const targets = targetRows.map(toPostTargetResponse)
            const type = (post.type ?? (mediaAssetsRows.length > 0 ? 'media' : 'text')) as PostType
            const firstMedia = mediaAssetsRows[0]

            return {
                postId: post.id,
                type,
                status: post.status as PostStatus,
                scheduledTime: post.scheduledTime,
                createdAt: post.createdAt,
                mainCaption: post.mainCaption ?? null,
                coverTimestamp: post.coverTimestamp ?? null,
                coverImageUrl: post.coverImageUrl ?? null,
                targets,
                ...(firstMedia
                    ? {
                          media: {
                              url: firstMedia.url,
                              type: firstMedia.type ?? 'application/octet-stream',
                          },
                      }
                    : {}),
            }
        } catch (error) {
            this.logger.error('Failed to get post details', {
                operation: 'PostsRepository.getPostDetails',
                postId,
                userId,
                error: formatError(error),
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to get post details', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPosts(userId: string, filters: PostFilters): Promise<PostsListResponse> {
        const page = filters.page || 1
        const limit = filters.limit || 9
        const offset = (page - 1) * limit

        try {
            const conditions = [eq(posts.userId, userId)]

            if (filters.workspaceId) {
                conditions.push(eq(posts.workspaceId, filters.workspaceId))
            }

            if (filters.status) {
                conditions.push(eq(posts.status, filters.status))
            }

            if (filters.fromDate) {
                conditions.push(gte(posts.createdAt, filters.fromDate))
            }

            if (filters.toDate) {
                conditions.push(lte(posts.createdAt, filters.toDate))
            }

            if (filters.platform) {
                const platformConditions = [eq(posts.userId, userId), eq(postTargets.platform, filters.platform)]
                if (filters.workspaceId) {
                    platformConditions.push(eq(posts.workspaceId, filters.workspaceId))
                }

                const matchingPosts = await this.db
                    .select({ postId: postTargets.postId })
                    .from(postTargets)
                    .innerJoin(posts, eq(postTargets.postId, posts.id))
                    .where(and(...platformConditions))

                const postIds = matchingPosts.map((row) => row.postId)
                if (postIds.length === 0) {
                    return { posts: [], total: 0, page, limit, hasMore: false }
                }

                conditions.push(inArray(posts.id, postIds))
            }

            const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)

            const [countRow] = await this.db
                .select({ total: sql<number>`count(*)` })
                .from(posts)
                .where(whereClause)

            const total = Number(countRow?.total ?? 0)

            const postRows = await this.db
                .select()
                .from(posts)
                .where(whereClause)
                .orderBy(desc(posts.scheduledTime), desc(posts.createdAt))
                .limit(limit)
                .offset(offset)

            if (postRows.length === 0) {
                return { posts: [], total, page, limit, hasMore: false }
            }

            const postIds = postRows.map((row) => row.id)

            const targetRows = await this.db.select().from(postTargets).where(inArray(postTargets.postId, postIds))

            const targetsByPost = new Map<string, PostTargetResponse[]>()
            targetRows.forEach((row) => {
                const existing = targetsByPost.get(row.postId) ?? []
                existing.push(toPostTargetResponse(row))
                targetsByPost.set(row.postId, existing)
            })

            const mediaRows = await this.db
                .select({
                    postId: postMediaAssets.postId,
                    mediaId: mediaAssets.id,
                    url: mediaAssets.url,
                    type: mediaAssets.type,
                    order: postMediaAssets.order,
                })
                .from(postMediaAssets)
                .innerJoin(mediaAssets, eq(postMediaAssets.mediaAssetId, mediaAssets.id))
                .where(inArray(postMediaAssets.postId, postIds))
                .orderBy(asc(postMediaAssets.order))

            const mediaByPost = new Map<string, PostMediaAsset[]>()
            mediaRows.forEach((row) => {
                const existing = mediaByPost.get(row.postId) ?? []
                existing.push(toPostMediaAsset(row))
                mediaByPost.set(row.postId, existing)
            })

            const postsResponse = postRows.map((row) => {
                const media = mediaByPost.get(row.id) ?? []
                const type = (row.type ?? (media.length > 0 ? 'media' : 'text')) as PostType
                return {
                    postId: row.id,
                    type,
                    status: row.status as PostStatus,
                    scheduledTime: row.scheduledTime,
                    createdAt: row.createdAt,
                    mainCaption: row.mainCaption ?? null,
                    coverTimestamp: row.coverTimestamp ?? null,
                    coverImageUrl: row.coverImageUrl ?? null,
                    targets: targetsByPost.get(row.id) ?? [],
                    media,
                }
            })

            return {
                posts: postsResponse,
                total,
                page,
                limit,
                hasMore: total > page * limit,
            }
        } catch (error) {
            this.logger.error('Failed to get posts', {
                operation: 'PostsRepository.getPosts',
                userId,
                filters,
                error: formatError(error),
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to get posts', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async updateBasePost(
        postId: string,
        userId: string,
        status: PostStatus,
        scheduledTime: Date | null,
        mainCaption?: string | null
    ): Promise<void> {
        try {
            const updateData: {
                status: PostStatus
                scheduledTime: Date | null
                updatedAt: Date
                mainCaption?: string | null
            } = {
                status,
                scheduledTime,
                updatedAt: new Date(),
            }

            if (typeof mainCaption !== 'undefined') {
                updateData.mainCaption = mainCaption
            }

            await this.db
                .update(posts)
                .set(updateData)
                .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
        } catch (error) {
            this.logger.error('Failed to update base post', {
                operation: 'PostsRepository.updateBasePost',
                postId,
                userId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to update post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostMediaAsset(postId: string): Promise<PostMediaAsset | null> {
        try {
            const [row] = await this.db
                .select({
                    mediaId: mediaAssets.id,
                    url: mediaAssets.url,
                    type: mediaAssets.type,
                    order: postMediaAssets.order,
                })
                .from(postMediaAssets)
                .innerJoin(mediaAssets, eq(postMediaAssets.mediaAssetId, mediaAssets.id))
                .where(eq(postMediaAssets.postId, postId))
                .orderBy(asc(postMediaAssets.order))
                .limit(1)

            if (!row) {
                return null
            }

            return toPostMediaAsset(row)
        } catch (error) {
            this.logger.error('Failed to get post media asset', {
                operation: 'PostsRepository.getPostMediaAsset',
                postId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to get post media asset', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostMediaAssets(postId: string): Promise<PostMediaAsset[]> {
        try {
            const rows = await this.db
                .select({
                    mediaId: mediaAssets.id,
                    url: mediaAssets.url,
                    type: mediaAssets.type,
                    order: postMediaAssets.order,
                })
                .from(postMediaAssets)
                .innerJoin(mediaAssets, eq(postMediaAssets.mediaAssetId, mediaAssets.id))
                .where(eq(postMediaAssets.postId, postId))
                .orderBy(asc(postMediaAssets.order))

            return rows.map(toPostMediaAsset)
        } catch (error) {
            this.logger.error('Failed to get post media assets', {
                operation: 'PostsRepository.getPostMediaAssets',
                postId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to get post media assets', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostCoverImageUrl(postId: string): Promise<string | null> {
        try {
            const [row] = await this.db
                .select({ coverImageUrl: posts.coverImageUrl })
                .from(posts)
                .where(eq(posts.id, postId))
                .limit(1)

            return row?.coverImageUrl ?? null
        } catch (error) {
            this.logger.error('Failed to get post cover image URL', {
                operation: 'PostsRepository.getPostCoverImageUrl',
                postId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to get post cover image URL', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async deletePostMediaAsset(mediaId: string): Promise<void> {
        try {
            await this.db.transaction(async (tx) => {
                await tx.delete(postMediaAssets).where(eq(postMediaAssets.mediaAssetId, mediaId))
                await tx.delete(mediaAssets).where(eq(mediaAssets.id, mediaId))
            })
        } catch (error) {
            this.logger.error('Failed to delete post media asset', {
                operation: 'PostsRepository.deletePostMediaAsset',
                mediaId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to delete post media asset', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async updatePostTargets(postId: string, targets: PostTarget[]): Promise<void> {
        try {
            await this.db.transaction(async (tx) => {
                await tx.delete(postTargets).where(eq(postTargets.postId, postId))

                if (targets.length === 0) {
                    return
                }

                await tx.insert(postTargets).values(
                    targets.map((target) => ({
                        postId,
                        socialAccountId: target.socialAccountId,
                        platform: target.platform,
                        text: target.text ?? null,
                        title: target.title ?? null,
                        status: PostStatus.PENDING,
                        pinterestBoardId: target.pinterestBoardId ?? null,
                        tags: target.tags ?? [],
                        links: target.links ?? [],
                        isAutoMusicEnabled: target.isAutoMusicEnabled ?? false,
                        instagramLocationId: target.instagramLocationId ?? null,
                        instagramFacebookPageId: target.instagramFacebookPageId ?? null,
                        threadsReplies: target.threadsReplies ?? [],
                        tikTokPostPrivacyLevel: target.tikTokPostPrivacyLevel ?? null,
                    }))
                )
            })
        } catch (error) {
            this.logger.error('Failed to update post targets', {
                operation: 'PostsRepository.updatePostTargets',
                postId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to update post targets', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async hasExistingMedia(postId: string): Promise<boolean> {
        try {
            const [row] = await this.db
                .select({ count: sql<number>`count(*)` })
                .from(postMediaAssets)
                .where(eq(postMediaAssets.postId, postId))

            return Number(row?.count ?? 0) > 0
        } catch (error) {
            this.logger.error('Failed to check existing media', {
                operation: 'PostsRepository.hasExistingMedia',
                postId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to check existing media', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsTargetedOnlyByAccount(userId: string, accountId: string): Promise<string[]> {
        try {
            const rows = await this.db
                .select({ postId: postTargets.postId })
                .from(postTargets)
                .innerJoin(posts, eq(postTargets.postId, posts.id))
                .where(eq(posts.userId, userId))
                .groupBy(postTargets.postId)
                .having(
                    sql`bool_or(${postTargets.socialAccountId} = ${accountId}) and count(distinct ${postTargets.socialAccountId}) = 1`
                )

            return rows.map((row) => row.postId)
        } catch (error) {
            this.logger.error('Failed to get posts targeted only by account', {
                operation: 'PostsRepository.getPostsTargetedOnlyByAccount',
                userId,
                accountId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to get posts targeted only by account', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async deletePost(postId: string, userId: string): Promise<{ mediaUrls: string[]; coverImageUrl?: string }> {
        try {
            return await this.db.transaction(async (tx) => {
                const [postRow] = await tx
                    .select({ coverImageUrl: posts.coverImageUrl })
                    .from(posts)
                    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
                    .limit(1)

                if (!postRow) {
                    throw new BaseAppError('Post not found or access denied', ErrorCode.NOT_FOUND, 404)
                }

                const mediaRows = await tx
                    .select({ id: mediaAssets.id, url: mediaAssets.url })
                    .from(mediaAssets)
                    .innerJoin(postMediaAssets, eq(postMediaAssets.mediaAssetId, mediaAssets.id))
                    .where(eq(postMediaAssets.postId, postId))

                await tx.delete(postMediaAssets).where(eq(postMediaAssets.postId, postId))
                await tx.delete(postTargets).where(eq(postTargets.postId, postId))

                const mediaIds = mediaRows.map((row) => row.id)
                if (mediaIds.length > 0) {
                    await tx.delete(mediaAssets).where(inArray(mediaAssets.id, mediaIds))
                }

                await tx.delete(posts).where(and(eq(posts.id, postId), eq(posts.userId, userId)))

                return {
                    mediaUrls: mediaRows.map((row) => row.url),
                    coverImageUrl: postRow.coverImageUrl ?? undefined,
                }
            })
        } catch (error) {
            this.logger.error('Failed to delete post', {
                operation: 'PostsRepository.deletePost',
                postId,
                userId,
                error: formatError(error),
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to delete post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsByDate(
        userId: string,
        fromDate: Date,
        toDate: Date,
        workspaceId?: string
    ): Promise<PostsByDateResponse> {
        try {
            const conditions = [
                eq(posts.userId, userId),
                gte(posts.createdAt, fromDate),
                lte(posts.createdAt, toDate),
                ne(posts.status, PostStatus.DRAFT),
            ]

            if (workspaceId) {
                conditions.push(eq(posts.workspaceId, workspaceId))
            }

            const postRows = await this.db
                .select()
                .from(posts)
                .where(and(...conditions))
                .orderBy(desc(posts.createdAt))

            if (postRows.length === 0) {
                return { posts: [] }
            }

            const postIds = postRows.map((row) => row.id)

            const targetRows = await this.db.select().from(postTargets).where(inArray(postTargets.postId, postIds))

            const targetsByPost = new Map<string, PostTargetResponse[]>()
            targetRows.forEach((row) => {
                const existing = targetsByPost.get(row.postId) ?? []
                existing.push(toPostTargetResponse(row))
                targetsByPost.set(row.postId, existing)
            })

            const mediaRows = await this.db
                .select({
                    postId: postMediaAssets.postId,
                    mediaId: mediaAssets.id,
                    url: mediaAssets.url,
                    type: mediaAssets.type,
                    order: postMediaAssets.order,
                })
                .from(postMediaAssets)
                .innerJoin(mediaAssets, eq(postMediaAssets.mediaAssetId, mediaAssets.id))
                .where(inArray(postMediaAssets.postId, postIds))
                .orderBy(asc(postMediaAssets.order))

            const mediaByPost = new Map<string, PostMediaAsset[]>()
            mediaRows.forEach((row) => {
                const existing = mediaByPost.get(row.postId) ?? []
                existing.push(toPostMediaAsset(row))
                mediaByPost.set(row.postId, existing)
            })

            const postsResponse = postRows.map((row) => {
                const media = mediaByPost.get(row.id) ?? []
                const type = (row.type ?? (media.length > 0 ? 'media' : 'text')) as PostType
                return {
                    postId: row.id,
                    type,
                    status: row.status as PostStatus,
                    scheduledTime: row.scheduledTime,
                    createdAt: row.createdAt,
                    mainCaption: row.mainCaption ?? null,
                    coverTimestamp: row.coverTimestamp ?? null,
                    coverImageUrl: row.coverImageUrl ?? null,
                    targets: targetsByPost.get(row.id) ?? [],
                    media,
                }
            })

            return { posts: postsResponse }
        } catch (error) {
            this.logger.error('Failed to get posts by date', {
                operation: 'PostsRepository.getPostsByDate',
                userId,
                fromDate,
                toDate,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to get posts by date', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async updatePostTarget(
        userId: string,
        postId: string,
        socialAccountId: string,
        status: PostStatus,
        errorMessage?: string
    ): Promise<void> {
        try {
            const updated = await this.db
                .update(postTargets)
                .set({
                    status,
                    errorMessage: errorMessage ?? null,
                })
                .where(and(eq(postTargets.postId, postId), eq(postTargets.socialAccountId, socialAccountId)))
                .returning({ postId: postTargets.postId })

            if (updated.length === 0) {
                throw new BaseAppError('Post target not found or access denied', ErrorCode.NOT_FOUND, 404)
            }
        } catch (error) {
            this.logger.error('Failed to update post target', {
                operation: 'PostsRepository.updatePostTarget',
                userId,
                postId,
                socialAccountId,
                error: formatError(error),
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to update post target', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsFailedCount(userId: string): Promise<number> {
        try {
            const [row] = await this.db
                .select({ total: sql<number>`count(*)` })
                .from(postTargets)
                .innerJoin(posts, eq(postTargets.postId, posts.id))
                .where(and(eq(posts.userId, userId), eq(postTargets.status, PostStatus.FAILED)))

            return Number(row?.total ?? 0)
        } catch (error) {
            this.logger.error('Failed to get failed posts count', {
                operation: 'PostsRepository.getPostsFailedCount',
                userId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to get failed posts count', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async retryPostTarget(
        userId: string,
        postId: string,
        socialAccountId: string
    ): Promise<{ postTarget: PostTargetResponse; post: CreatePostResponse }> {
        try {
            const [targetRow] = await this.db
                .select({
                    postId: postTargets.postId,
                })
                .from(postTargets)
                .innerJoin(posts, eq(postTargets.postId, posts.id))
                .where(
                    and(
                        eq(postTargets.postId, postId),
                        eq(postTargets.socialAccountId, socialAccountId),
                        eq(posts.userId, userId),
                        eq(postTargets.status, PostStatus.FAILED)
                    )
                )
                .limit(1)

            if (!targetRow) {
                throw new BaseAppError(
                    'Post target not found, not in FAILED status, or access denied',
                    ErrorCode.NOT_FOUND,
                    404
                )
            }

            await this.db
                .update(postTargets)
                .set({ status: PostStatus.PENDING, errorMessage: null })
                .where(and(eq(postTargets.postId, postId), eq(postTargets.socialAccountId, socialAccountId)))

            const postDetails = await this.getPostDetails(postId, userId)
            const retriedTarget = postDetails.targets.find((target) => target.socialAccountId === socialAccountId)

            if (!retriedTarget) {
                throw new BaseAppError('Failed to retrieve retried target', ErrorCode.UNKNOWN_ERROR, 500)
            }

            return {
                postTarget: retriedTarget,
                post: postDetails,
            }
        } catch (error) {
            this.logger.error('Failed to retry post target', {
                operation: 'PostsRepository.retryPostTarget',
                userId,
                postId,
                socialAccountId,
                error: formatError(error),
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to retry post target', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async deletePostTarget(userId: string, postId: string, socialAccountId: string): Promise<void> {
        try {
            const [targetRow] = await this.db
                .select({ postId: postTargets.postId })
                .from(postTargets)
                .innerJoin(posts, eq(postTargets.postId, posts.id))
                .where(
                    and(
                        eq(postTargets.postId, postId),
                        eq(postTargets.socialAccountId, socialAccountId),
                        eq(posts.userId, userId)
                    )
                )
                .limit(1)

            if (!targetRow) {
                throw new BaseAppError('Post target not found or access denied', ErrorCode.NOT_FOUND, 404)
            }

            await this.db
                .delete(postTargets)
                .where(and(eq(postTargets.postId, postId), eq(postTargets.socialAccountId, socialAccountId)))
        } catch (error) {
            this.logger.error('Failed to delete post target', {
                operation: 'PostsRepository.deletePostTarget',
                userId,
                postId,
                socialAccountId,
                error: formatError(error),
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to delete post target', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getFailedPostTargets(userId: string): Promise<PostTargetEntity[]> {
        try {
            const rows = await this.db
                .select({
                    postId: postTargets.postId,
                    socialAccountId: postTargets.socialAccountId,
                    platform: postTargets.platform,
                    status: postTargets.status,
                    errorMessage: postTargets.errorMessage,
                    text: postTargets.text,
                    title: postTargets.title,
                    pinterestBoardId: postTargets.pinterestBoardId,
                    userId: posts.userId,
                })
                .from(postTargets)
                .innerJoin(posts, eq(postTargets.postId, posts.id))
                .where(and(eq(posts.userId, userId), eq(postTargets.status, PostStatus.FAILED)))

            return rows.map(
                (row) =>
                    new PostTargetEntity(
                        row.postId,
                        row.socialAccountId,
                        row.platform,
                        row.status,
                        row.errorMessage ?? undefined,
                        row.text ?? undefined,
                        row.title ?? undefined,
                        row.pinterestBoardId ?? undefined,
                        row.userId
                    )
            )
        } catch (error) {
            this.logger.error('Failed to get failed post targets', {
                operation: 'PostsRepository.getFailedPostTargets',
                userId,
                error: formatError(error),
            })
            throw new BaseAppError('Failed to get failed post targets', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }
}
