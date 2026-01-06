"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
const post_target_1 = require("@/modules/post/entity/post-target");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const forma_error_1 = require("@/shared/utils/forma-error");
const posts_types_1 = require("@/modules/post/types/posts.types");
const post_mappers_1 = require("../entity/post.mappers");
const post_schema_1 = require("../entity/post.schema");
class PostsRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async createBasePost(userId, workspaceId, status, postType, scheduledTime, mainCaption, coverTimestamp, coverImageUrl) {
        try {
            const postId = (0, uuid_1.v4)();
            await this.db.insert(post_schema_1.posts).values({
                id: postId,
                userId,
                workspaceId,
                status,
                type: postType,
                scheduledTime,
                mainCaption: mainCaption ?? null,
                coverTimestamp: coverTimestamp ?? null,
                coverImageUrl: coverImageUrl ?? null,
            });
            return { postId };
        }
        catch (error) {
            this.logger.error('Failed to create base post', {
                operation: 'PostsRepository.createBasePost',
                userId,
                workspaceId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to create post', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async savePostMediaAssets(data) {
        try {
            const mediaId = (0, uuid_1.v4)();
            await this.db.insert(post_schema_1.mediaAssets).values({
                id: mediaId,
                userId: data.userId,
                url: data.url,
                type: data.type,
            });
            return { mediaId };
        }
        catch (error) {
            this.logger.error('Failed to save media asset', {
                operation: 'PostsRepository.savePostMediaAssets',
                userId: data.userId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to save media asset', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async createPostMediaAssetRelation(postId, mediaId, order) {
        try {
            await this.db.insert(post_schema_1.postMediaAssets).values({
                postId,
                mediaAssetId: mediaId,
                order,
            });
        }
        catch (error) {
            this.logger.error('Failed to create post media relation', {
                operation: 'PostsRepository.createPostMediaAssetRelation',
                postId,
                mediaId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to create post media relation', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async createPostTargets(targets) {
        try {
            await this.db.transaction(async (tx) => {
                if (targets.length === 0)
                    return;
                await tx.insert(post_schema_1.postTargets).values(targets.map((target) => ({
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
                })));
            });
        }
        catch (error) {
            this.logger.error('Failed to create post targets', {
                operation: 'PostsRepository.createPostTargets',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to create post targets', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostDetails(postId, userId) {
        try {
            const [post] = await this.db
                .select()
                .from(post_schema_1.posts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.posts.id, postId.trim()), (0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId.trim())))
                .limit(1);
            if (!post) {
                throw new base_error_1.BaseAppError('Post not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const mediaAssetsRows = await this.getPostMediaAssets(postId);
            const targetRows = await this.db
                .select()
                .from(post_schema_1.postTargets)
                .where((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId));
            const targets = targetRows.map(post_mappers_1.toPostTargetResponse);
            const type = (post.type ?? (mediaAssetsRows.length > 0 ? 'media' : 'text'));
            const firstMedia = mediaAssetsRows[0];
            return {
                postId: post.id,
                type,
                status: post.status,
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
            };
        }
        catch (error) {
            this.logger.error('Failed to get post details', {
                operation: 'PostsRepository.getPostDetails',
                postId,
                userId,
                error: (0, forma_error_1.formatError)(error),
            });
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to get post details', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPosts(userId, filters) {
        const page = filters.page || 1;
        const limit = filters.limit || 9;
        const offset = (page - 1) * limit;
        try {
            const conditions = [(0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId)];
            if (filters.workspaceId) {
                conditions.push((0, drizzle_orm_1.eq)(post_schema_1.posts.workspaceId, filters.workspaceId));
            }
            if (filters.status) {
                conditions.push((0, drizzle_orm_1.eq)(post_schema_1.posts.status, filters.status));
            }
            if (filters.fromDate) {
                conditions.push((0, drizzle_orm_1.gte)(post_schema_1.posts.createdAt, filters.fromDate));
            }
            if (filters.toDate) {
                conditions.push((0, drizzle_orm_1.lte)(post_schema_1.posts.createdAt, filters.toDate));
            }
            if (filters.platform) {
                const platformConditions = [(0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.platform, filters.platform)];
                if (filters.workspaceId) {
                    platformConditions.push((0, drizzle_orm_1.eq)(post_schema_1.posts.workspaceId, filters.workspaceId));
                }
                const matchingPosts = await this.db
                    .select({ postId: post_schema_1.postTargets.postId })
                    .from(post_schema_1.postTargets)
                    .innerJoin(post_schema_1.posts, (0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, post_schema_1.posts.id))
                    .where((0, drizzle_orm_1.and)(...platformConditions));
                const postIds = matchingPosts.map((row) => row.postId);
                if (postIds.length === 0) {
                    return { posts: [], total: 0, page, limit, hasMore: false };
                }
                conditions.push((0, drizzle_orm_1.inArray)(post_schema_1.posts.id, postIds));
            }
            const whereClause = conditions.length === 1 ? conditions[0] : (0, drizzle_orm_1.and)(...conditions);
            const [countRow] = await this.db
                .select({ total: (0, drizzle_orm_1.sql) `count(*)` })
                .from(post_schema_1.posts)
                .where(whereClause);
            const total = Number(countRow?.total ?? 0);
            const postRows = await this.db
                .select()
                .from(post_schema_1.posts)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(post_schema_1.posts.scheduledTime), (0, drizzle_orm_1.desc)(post_schema_1.posts.createdAt))
                .limit(limit)
                .offset(offset);
            if (postRows.length === 0) {
                return { posts: [], total, page, limit, hasMore: false };
            }
            const postIds = postRows.map((row) => row.id);
            const targetRows = await this.db
                .select()
                .from(post_schema_1.postTargets)
                .where((0, drizzle_orm_1.inArray)(post_schema_1.postTargets.postId, postIds));
            const targetsByPost = new Map();
            targetRows.forEach((row) => {
                const existing = targetsByPost.get(row.postId) ?? [];
                existing.push((0, post_mappers_1.toPostTargetResponse)(row));
                targetsByPost.set(row.postId, existing);
            });
            const mediaRows = await this.db
                .select({
                postId: post_schema_1.postMediaAssets.postId,
                mediaId: post_schema_1.mediaAssets.id,
                url: post_schema_1.mediaAssets.url,
                type: post_schema_1.mediaAssets.type,
                order: post_schema_1.postMediaAssets.order,
            })
                .from(post_schema_1.postMediaAssets)
                .innerJoin(post_schema_1.mediaAssets, (0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.mediaAssetId, post_schema_1.mediaAssets.id))
                .where((0, drizzle_orm_1.inArray)(post_schema_1.postMediaAssets.postId, postIds))
                .orderBy((0, drizzle_orm_1.asc)(post_schema_1.postMediaAssets.order));
            const mediaByPost = new Map();
            mediaRows.forEach((row) => {
                const existing = mediaByPost.get(row.postId) ?? [];
                existing.push((0, post_mappers_1.toPostMediaAsset)(row));
                mediaByPost.set(row.postId, existing);
            });
            const postsResponse = postRows.map((row) => {
                const media = mediaByPost.get(row.id) ?? [];
                const type = (row.type ?? (media.length > 0 ? 'media' : 'text'));
                return {
                    postId: row.id,
                    type,
                    status: row.status,
                    scheduledTime: row.scheduledTime,
                    createdAt: row.createdAt,
                    mainCaption: row.mainCaption ?? null,
                    coverTimestamp: row.coverTimestamp ?? null,
                    coverImageUrl: row.coverImageUrl ?? null,
                    targets: targetsByPost.get(row.id) ?? [],
                    media,
                };
            });
            return {
                posts: postsResponse,
                total,
                page,
                limit,
                hasMore: total > page * limit,
            };
        }
        catch (error) {
            this.logger.error('Failed to get posts', {
                operation: 'PostsRepository.getPosts',
                userId,
                filters,
                error: (0, forma_error_1.formatError)(error),
            });
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to get posts', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async updateBasePost(postId, userId, status, scheduledTime, mainCaption) {
        try {
            const updateData = {
                status,
                scheduledTime,
                updatedAt: new Date(),
            };
            if (typeof mainCaption !== 'undefined') {
                updateData.mainCaption = mainCaption;
            }
            await this.db.update(post_schema_1.posts).set(updateData).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.posts.id, postId), (0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId)));
        }
        catch (error) {
            this.logger.error('Failed to update base post', {
                operation: 'PostsRepository.updateBasePost',
                postId,
                userId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to update post', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostMediaAsset(postId) {
        try {
            const [row] = await this.db
                .select({
                mediaId: post_schema_1.mediaAssets.id,
                url: post_schema_1.mediaAssets.url,
                type: post_schema_1.mediaAssets.type,
                order: post_schema_1.postMediaAssets.order,
            })
                .from(post_schema_1.postMediaAssets)
                .innerJoin(post_schema_1.mediaAssets, (0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.mediaAssetId, post_schema_1.mediaAssets.id))
                .where((0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.postId, postId))
                .orderBy((0, drizzle_orm_1.asc)(post_schema_1.postMediaAssets.order))
                .limit(1);
            if (!row) {
                return null;
            }
            return (0, post_mappers_1.toPostMediaAsset)(row);
        }
        catch (error) {
            this.logger.error('Failed to get post media asset', {
                operation: 'PostsRepository.getPostMediaAsset',
                postId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to get post media asset', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostMediaAssets(postId) {
        try {
            const rows = await this.db
                .select({
                mediaId: post_schema_1.mediaAssets.id,
                url: post_schema_1.mediaAssets.url,
                type: post_schema_1.mediaAssets.type,
                order: post_schema_1.postMediaAssets.order,
            })
                .from(post_schema_1.postMediaAssets)
                .innerJoin(post_schema_1.mediaAssets, (0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.mediaAssetId, post_schema_1.mediaAssets.id))
                .where((0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.postId, postId))
                .orderBy((0, drizzle_orm_1.asc)(post_schema_1.postMediaAssets.order));
            return rows.map(post_mappers_1.toPostMediaAsset);
        }
        catch (error) {
            this.logger.error('Failed to get post media assets', {
                operation: 'PostsRepository.getPostMediaAssets',
                postId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to get post media assets', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostCoverImageUrl(postId) {
        try {
            const [row] = await this.db
                .select({ coverImageUrl: post_schema_1.posts.coverImageUrl })
                .from(post_schema_1.posts)
                .where((0, drizzle_orm_1.eq)(post_schema_1.posts.id, postId))
                .limit(1);
            return row?.coverImageUrl ?? null;
        }
        catch (error) {
            this.logger.error('Failed to get post cover image URL', {
                operation: 'PostsRepository.getPostCoverImageUrl',
                postId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to get post cover image URL', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async deletePostMediaAsset(mediaId) {
        try {
            await this.db.transaction(async (tx) => {
                await tx.delete(post_schema_1.postMediaAssets).where((0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.mediaAssetId, mediaId));
                await tx.delete(post_schema_1.mediaAssets).where((0, drizzle_orm_1.eq)(post_schema_1.mediaAssets.id, mediaId));
            });
        }
        catch (error) {
            this.logger.error('Failed to delete post media asset', {
                operation: 'PostsRepository.deletePostMediaAsset',
                mediaId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to delete post media asset', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async updatePostTargets(postId, targets) {
        try {
            await this.db.transaction(async (tx) => {
                await tx.delete(post_schema_1.postTargets).where((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId));
                if (targets.length === 0) {
                    return;
                }
                await tx.insert(post_schema_1.postTargets).values(targets.map((target) => ({
                    postId,
                    socialAccountId: target.socialAccountId,
                    platform: target.platform,
                    text: target.text ?? null,
                    title: target.title ?? null,
                    status: posts_types_1.PostStatus.PENDING,
                    pinterestBoardId: target.pinterestBoardId ?? null,
                    tags: target.tags ?? [],
                    links: target.links ?? [],
                    isAutoMusicEnabled: target.isAutoMusicEnabled ?? false,
                    instagramLocationId: target.instagramLocationId ?? null,
                    instagramFacebookPageId: target.instagramFacebookPageId ?? null,
                    threadsReplies: target.threadsReplies ?? [],
                    tikTokPostPrivacyLevel: target.tikTokPostPrivacyLevel ?? null,
                })));
            });
        }
        catch (error) {
            this.logger.error('Failed to update post targets', {
                operation: 'PostsRepository.updatePostTargets',
                postId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to update post targets', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async hasExistingMedia(postId) {
        try {
            const [row] = await this.db
                .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
                .from(post_schema_1.postMediaAssets)
                .where((0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.postId, postId));
            return Number(row?.count ?? 0) > 0;
        }
        catch (error) {
            this.logger.error('Failed to check existing media', {
                operation: 'PostsRepository.hasExistingMedia',
                postId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to check existing media', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostsTargetedOnlyByAccount(userId, accountId) {
        try {
            const rows = await this.db
                .select({ postId: post_schema_1.postTargets.postId })
                .from(post_schema_1.postTargets)
                .innerJoin(post_schema_1.posts, (0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, post_schema_1.posts.id))
                .where((0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId))
                .groupBy(post_schema_1.postTargets.postId)
                .having((0, drizzle_orm_1.sql) `bool_or(${post_schema_1.postTargets.socialAccountId} = ${accountId}) and count(distinct ${post_schema_1.postTargets.socialAccountId}) = 1`);
            return rows.map((row) => row.postId);
        }
        catch (error) {
            this.logger.error('Failed to get posts targeted only by account', {
                operation: 'PostsRepository.getPostsTargetedOnlyByAccount',
                userId,
                accountId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to get posts targeted only by account', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async deletePost(postId, userId) {
        try {
            return await this.db.transaction(async (tx) => {
                const [postRow] = await tx
                    .select({ coverImageUrl: post_schema_1.posts.coverImageUrl })
                    .from(post_schema_1.posts)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.posts.id, postId), (0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId)))
                    .limit(1);
                if (!postRow) {
                    throw new base_error_1.BaseAppError('Post not found or access denied', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
                }
                const mediaRows = await tx
                    .select({ id: post_schema_1.mediaAssets.id, url: post_schema_1.mediaAssets.url })
                    .from(post_schema_1.mediaAssets)
                    .innerJoin(post_schema_1.postMediaAssets, (0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.mediaAssetId, post_schema_1.mediaAssets.id))
                    .where((0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.postId, postId));
                await tx.delete(post_schema_1.postMediaAssets).where((0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.postId, postId));
                await tx.delete(post_schema_1.postTargets).where((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId));
                const mediaIds = mediaRows.map((row) => row.id);
                if (mediaIds.length > 0) {
                    await tx.delete(post_schema_1.mediaAssets).where((0, drizzle_orm_1.inArray)(post_schema_1.mediaAssets.id, mediaIds));
                }
                await tx.delete(post_schema_1.posts).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.posts.id, postId), (0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId)));
                return {
                    mediaUrls: mediaRows.map((row) => row.url),
                    coverImageUrl: postRow.coverImageUrl ?? undefined,
                };
            });
        }
        catch (error) {
            this.logger.error('Failed to delete post', {
                operation: 'PostsRepository.deletePost',
                postId,
                userId,
                error: (0, forma_error_1.formatError)(error),
            });
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to delete post', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostsByDate(userId, fromDate, toDate, workspaceId) {
        try {
            const conditions = [
                (0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId),
                (0, drizzle_orm_1.gte)(post_schema_1.posts.createdAt, fromDate),
                (0, drizzle_orm_1.lte)(post_schema_1.posts.createdAt, toDate),
                (0, drizzle_orm_1.ne)(post_schema_1.posts.status, posts_types_1.PostStatus.DRAFT)
            ];
            if (workspaceId) {
                conditions.push((0, drizzle_orm_1.eq)(post_schema_1.posts.workspaceId, workspaceId));
            }
            const postRows = await this.db
                .select()
                .from(post_schema_1.posts)
                .where((0, drizzle_orm_1.and)(...conditions))
                .orderBy((0, drizzle_orm_1.desc)(post_schema_1.posts.createdAt));
            if (postRows.length === 0) {
                return { posts: [] };
            }
            const postIds = postRows.map((row) => row.id);
            const targetRows = await this.db
                .select()
                .from(post_schema_1.postTargets)
                .where((0, drizzle_orm_1.inArray)(post_schema_1.postTargets.postId, postIds));
            const targetsByPost = new Map();
            targetRows.forEach((row) => {
                const existing = targetsByPost.get(row.postId) ?? [];
                existing.push((0, post_mappers_1.toPostTargetResponse)(row));
                targetsByPost.set(row.postId, existing);
            });
            const mediaRows = await this.db
                .select({
                postId: post_schema_1.postMediaAssets.postId,
                mediaId: post_schema_1.mediaAssets.id,
                url: post_schema_1.mediaAssets.url,
                type: post_schema_1.mediaAssets.type,
                order: post_schema_1.postMediaAssets.order,
            })
                .from(post_schema_1.postMediaAssets)
                .innerJoin(post_schema_1.mediaAssets, (0, drizzle_orm_1.eq)(post_schema_1.postMediaAssets.mediaAssetId, post_schema_1.mediaAssets.id))
                .where((0, drizzle_orm_1.inArray)(post_schema_1.postMediaAssets.postId, postIds))
                .orderBy((0, drizzle_orm_1.asc)(post_schema_1.postMediaAssets.order));
            const mediaByPost = new Map();
            mediaRows.forEach((row) => {
                const existing = mediaByPost.get(row.postId) ?? [];
                existing.push((0, post_mappers_1.toPostMediaAsset)(row));
                mediaByPost.set(row.postId, existing);
            });
            const postsResponse = postRows.map((row) => {
                const media = mediaByPost.get(row.id) ?? [];
                const type = (row.type ?? (media.length > 0 ? 'media' : 'text'));
                return {
                    postId: row.id,
                    type,
                    status: row.status,
                    scheduledTime: row.scheduledTime,
                    createdAt: row.createdAt,
                    mainCaption: row.mainCaption ?? null,
                    coverTimestamp: row.coverTimestamp ?? null,
                    coverImageUrl: row.coverImageUrl ?? null,
                    targets: targetsByPost.get(row.id) ?? [],
                    media,
                };
            });
            return { posts: postsResponse };
        }
        catch (error) {
            this.logger.error('Failed to get posts by date', {
                operation: 'PostsRepository.getPostsByDate',
                userId,
                fromDate,
                toDate,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to get posts by date', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async updatePostTarget(userId, postId, socialAccountId, status, errorMessage) {
        try {
            const updated = await this.db
                .update(post_schema_1.postTargets)
                .set({
                status,
                errorMessage: errorMessage ?? null,
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.socialAccountId, socialAccountId)))
                .returning({ postId: post_schema_1.postTargets.postId });
            if (updated.length === 0) {
                throw new base_error_1.BaseAppError('Post target not found or access denied', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
        }
        catch (error) {
            this.logger.error('Failed to update post target', {
                operation: 'PostsRepository.updatePostTarget',
                userId,
                postId,
                socialAccountId,
                error: (0, forma_error_1.formatError)(error),
            });
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to update post target', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostsFailedCount(userId) {
        try {
            const [row] = await this.db
                .select({ total: (0, drizzle_orm_1.sql) `count(*)` })
                .from(post_schema_1.postTargets)
                .innerJoin(post_schema_1.posts, (0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, post_schema_1.posts.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.status, posts_types_1.PostStatus.FAILED)));
            return Number(row?.total ?? 0);
        }
        catch (error) {
            this.logger.error('Failed to get failed posts count', {
                operation: 'PostsRepository.getPostsFailedCount',
                userId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to get failed posts count', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async retryPostTarget(userId, postId, socialAccountId) {
        try {
            const [targetRow] = await this.db
                .select({
                postId: post_schema_1.postTargets.postId,
            })
                .from(post_schema_1.postTargets)
                .innerJoin(post_schema_1.posts, (0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, post_schema_1.posts.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.socialAccountId, socialAccountId), (0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.status, posts_types_1.PostStatus.FAILED)))
                .limit(1);
            if (!targetRow) {
                throw new base_error_1.BaseAppError('Post target not found, not in FAILED status, or access denied', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            await this.db.update(post_schema_1.postTargets).set({ status: posts_types_1.PostStatus.PENDING, errorMessage: null }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.socialAccountId, socialAccountId)));
            const postDetails = await this.getPostDetails(postId, userId);
            const retriedTarget = postDetails.targets.find((target) => target.socialAccountId === socialAccountId);
            if (!retriedTarget) {
                throw new base_error_1.BaseAppError('Failed to retrieve retried target', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
            }
            return {
                postTarget: retriedTarget,
                post: postDetails,
            };
        }
        catch (error) {
            this.logger.error('Failed to retry post target', {
                operation: 'PostsRepository.retryPostTarget',
                userId,
                postId,
                socialAccountId,
                error: (0, forma_error_1.formatError)(error),
            });
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to retry post target', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async deletePostTarget(userId, postId, socialAccountId) {
        try {
            const [targetRow] = await this.db
                .select({ postId: post_schema_1.postTargets.postId })
                .from(post_schema_1.postTargets)
                .innerJoin(post_schema_1.posts, (0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, post_schema_1.posts.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.socialAccountId, socialAccountId), (0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId)))
                .limit(1);
            if (!targetRow) {
                throw new base_error_1.BaseAppError('Post target not found or access denied', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            await this.db
                .delete(post_schema_1.postTargets)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, postId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.socialAccountId, socialAccountId)));
        }
        catch (error) {
            this.logger.error('Failed to delete post target', {
                operation: 'PostsRepository.deletePostTarget',
                userId,
                postId,
                socialAccountId,
                error: (0, forma_error_1.formatError)(error),
            });
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to delete post target', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getFailedPostTargets(userId) {
        try {
            const rows = await this.db
                .select({
                postId: post_schema_1.postTargets.postId,
                socialAccountId: post_schema_1.postTargets.socialAccountId,
                platform: post_schema_1.postTargets.platform,
                status: post_schema_1.postTargets.status,
                errorMessage: post_schema_1.postTargets.errorMessage,
                text: post_schema_1.postTargets.text,
                title: post_schema_1.postTargets.title,
                pinterestBoardId: post_schema_1.postTargets.pinterestBoardId,
                userId: post_schema_1.posts.userId,
            })
                .from(post_schema_1.postTargets)
                .innerJoin(post_schema_1.posts, (0, drizzle_orm_1.eq)(post_schema_1.postTargets.postId, post_schema_1.posts.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(post_schema_1.posts.userId, userId), (0, drizzle_orm_1.eq)(post_schema_1.postTargets.status, posts_types_1.PostStatus.FAILED)));
            return rows.map((row) => new post_target_1.PostTargetEntity(row.postId, row.socialAccountId, row.platform, row.status, row.errorMessage ?? undefined, row.text ?? undefined, row.title ?? undefined, row.pinterestBoardId ?? undefined, row.userId));
        }
        catch (error) {
            this.logger.error('Failed to get failed post targets', {
                operation: 'PostsRepository.getFailedPostTargets',
                userId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to get failed post targets', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.PostsRepository = PostsRepository;
