"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostsController = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const getFirstValue = (value) => {
    if (Array.isArray(value)) {
        const [first] = value;
        return typeof first === 'string' || typeof first === 'number' ? first : undefined;
    }
    return typeof value === 'string' || typeof value === 'number' ? value : undefined;
};
const parseBoolean = (value) => {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true')
            return true;
        if (value.toLowerCase() === 'false')
            return false;
    }
    return undefined;
};
const parseJson = (value) => {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return undefined;
        }
    }
    if (typeof value === 'object' && value !== null) {
        return value;
    }
    return undefined;
};
const parseDate = (value) => {
    if (value instanceof Date)
        return value;
    if (typeof value === 'number' && !Number.isNaN(value)) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    if (typeof value === 'string' && value.trim() !== '') {
        // Try parsing as a numeric timestamp first (milliseconds since epoch)
        const numericValue = Number(value);
        if (!Number.isNaN(numericValue) && numericValue > 0) {
            const parsed = new Date(numericValue);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        // Fallback to standard date string parsing
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return null;
};
const parseCreatePostsRequest = (body) => {
    const posts = parseJson(body.posts) ?? [];
    const copyDataUrls = parseJson(body.copyDataUrls) ?? undefined;
    const coverTimestamp = typeof body.coverTimestamp === 'number'
        ? body.coverTimestamp
        : typeof body.coverTimestamp === 'string' && body.coverTimestamp.trim() !== ''
            ? Number(body.coverTimestamp)
            : undefined;
    return {
        postType: body.postType,
        postStatus: body.postStatus,
        posts,
        postNow: parseBoolean(body.postNow),
        scheduledTime: parseDate(body.scheduledTime),
        mainCaption: body.mainCaption ?? null,
        coverTimestamp: Number.isNaN(coverTimestamp)
            ? undefined
            : coverTimestamp,
        copyDataUrls,
    };
};
const isCompatibilityError = (value) => {
    return Boolean(value && typeof value === 'object' && 'ok' in value && value.ok === false);
};
class PostsController {
    constructor(postsService, logger) {
        this.postsService = postsService;
        this.logger = logger;
    }
    async createPost(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const payload = parseCreatePostsRequest(req.body);
        const medias = req.files;
        const result = await this.postsService.createPost(payload, medias, userId);
        if (isCompatibilityError(result)) {
            res.status(result.status).json(result);
            return;
        }
        this.logger.info('Post created', {
            operation: 'PostsController.createPost',
            userId,
            postId: result.postId,
            status: result.status,
        });
        res.status(201).json(result);
    }
    async editPost(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const { postId } = req.params;
        if (!postId) {
            throw new base_error_1.BaseAppError('Post ID is required', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        const payload = parseCreatePostsRequest(req.body);
        const file = req.file;
        await this.postsService.editPost(postId, payload, file, userId);
        this.logger.info('Post updated', {
            operation: 'PostsController.editPost',
            userId,
            postId,
        });
        res.status(204).end();
    }
    async deletePost(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const { postId } = req.params;
        if (!postId) {
            throw new base_error_1.BaseAppError('Post ID is required', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        await this.postsService.deletePost(postId, userId);
        res.status(204).end();
    }
    async getPostsByFilters(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const filters = {
            page: Number(getFirstValue(req.query.page)) || undefined,
            limit: Number(getFirstValue(req.query.limit)) || undefined,
            status: getFirstValue(req.query.status),
            platform: getFirstValue(req.query.platform),
            fromDate: parseDate(getFirstValue(req.query.fromDate)) ?? undefined,
            toDate: parseDate(getFirstValue(req.query.toDate)) ?? undefined,
        };
        const result = await this.postsService.getPostsByFilters(userId, filters);
        res.json(result);
    }
    async getPostsByDate(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const fromDateRaw = getFirstValue(req.query.fromDate);
        const toDateRaw = getFirstValue(req.query.toDate);
        const fromDate = parseDate(fromDateRaw);
        const toDate = parseDate(toDateRaw);
        if (!fromDate || !toDate) {
            throw new base_error_1.BaseAppError('fromDate and toDate are required', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        const result = await this.postsService.getPostsByDate(userId, fromDate, toDate);
        res.json(result);
    }
    async getPostsFailedCount(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const count = await this.postsService.getPostsFailedCount(userId);
        res.json({ count });
    }
    async getFailedPostTargets(req, res, _next) {
        const userId = req.user?.id;
        this.logger.debug('User ID: ', { userId });
        if (!userId)
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        const result = await this.postsService.getFailedPostTargets(userId);
        this.logger.debug('Failed Targets: ', { result });
        res.json({ targets: result });
    }
    async retryPostTarget(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const postId = req.body?.postId;
        const socialAccountId = req.body?.socialAccountId;
        if (!postId || !socialAccountId) {
            throw new base_error_1.BaseAppError('postId and socialAccountId are required', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        const result = await this.postsService.retryPostTarget(userId, postId, socialAccountId);
        res.json(result);
    }
    async deletePostTarget(req, res, _next) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        const postId = req.body?.postId;
        const socialAccountId = req.body?.socialAccountId;
        if (!postId || !socialAccountId) {
            throw new base_error_1.BaseAppError('postId and socialAccountId are required', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        await this.postsService.deletePostTarget(userId, postId, socialAccountId);
        res.status(204).end();
    }
    async getRateLimits(_req, res, _next) {
        res.json({ limits: null });
    }
}
exports.PostsController = PostsController;
