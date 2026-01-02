import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import type { IPostsService, MediaCompatibilityError } from '@/modules/post/services/posts-service.interface'
import type { CreatePostsRequest } from '@/modules/post/schemas/posts.schemas'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { PostFilters } from '@/modules/post/types/posts.types'
import type { NextFunction, Request, Response } from 'express'

const getFirstValue = (value: unknown): string | number | undefined => {
    if (Array.isArray(value)) {
        const [first] = value
        return typeof first === 'string' || typeof first === 'number' ? first : undefined
    }
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

const parseBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true
        if (value.toLowerCase() === 'false') return false
    }
    return undefined
}

const parseJson = <T>(value: unknown): T | undefined => {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T
        } catch {
            return undefined
        }
    }
    if (typeof value === 'object' && value !== null) {
        return value as T
    }
    return undefined
}

const parseDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value
    if (typeof value === 'number' && !Number.isNaN(value)) {
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed
        }
    }
    if (typeof value === 'string' && value.trim() !== '') {
        // Try parsing as a numeric timestamp first (milliseconds since epoch)
        const numericValue = Number(value)
        if (!Number.isNaN(numericValue) && numericValue > 0) {
            const parsed = new Date(numericValue)
            if (!Number.isNaN(parsed.getTime())) {
                return parsed
            }
        }
        // Fallback to standard date string parsing
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed
        }
    }
    return null
}

const parseCreatePostsRequest = (body: Request['body']): CreatePostsRequest => {
    const posts = parseJson<CreatePostsRequest['posts']>(body.posts) ?? []
    const copyDataUrls = parseJson<string[]>(body.copyDataUrls) ?? undefined
    const coverTimestamp =
        typeof body.coverTimestamp === 'number'
            ? body.coverTimestamp
            : typeof body.coverTimestamp === 'string' && body.coverTimestamp.trim() !== ''
              ? Number(body.coverTimestamp)
              : undefined

    return {
        postType: body.postType,
        postStatus: body.postStatus,
        posts,
        postNow: parseBoolean(body.postNow),
        scheduledTime: parseDate(body.scheduledTime),
        mainCaption: body.mainCaption ?? null,
        coverTimestamp: Number.isNaN(coverTimestamp as number)
            ? undefined
            : (coverTimestamp as number | undefined),
        copyDataUrls,
    }
}

const isCompatibilityError = (value: unknown): value is MediaCompatibilityError => {
    return Boolean(value && typeof value === 'object' && 'ok' in value && (value as { ok?: boolean }).ok === false)
}

export class PostsController {
    private readonly postsService: IPostsService
    private readonly logger: ILogger

    constructor(postsService: IPostsService, logger: ILogger) {
        this.postsService = postsService
        this.logger = logger
    }

    async createPost(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const payload = parseCreatePostsRequest(req.body)
        const medias = req.files as { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]

        const result = await this.postsService.createPost(payload, medias, userId)

        if (isCompatibilityError(result)) {
            res.status(result.status).json(result)
            return
        }

        this.logger.info('Post created', {
            operation: 'PostsController.createPost',
            userId,
            postId: result.postId,
            status: result.status,
        })

        res.status(201).json(result)
    }

    async editPost(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const { postId } = req.params
        if (!postId) {
            throw new BaseAppError('Post ID is required', ErrorCode.BAD_REQUEST, 400)
        }

        const payload = parseCreatePostsRequest(req.body)
        const file = req.file

        await this.postsService.editPost(postId, payload, file, userId)

        this.logger.info('Post updated', {
            operation: 'PostsController.editPost',
            userId,
            postId,
        })

        res.status(204).end()
    }

    async deletePost(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const { postId } = req.params
        if (!postId) {
            throw new BaseAppError('Post ID is required', ErrorCode.BAD_REQUEST, 400)
        }

        await this.postsService.deletePost(postId, userId)

        res.status(204).end()
    }

    async getPostsByFilters(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const filters: PostFilters = {
            page: Number(getFirstValue(req.query.page)) || undefined,
            limit: Number(getFirstValue(req.query.limit)) || undefined,
            status: getFirstValue(req.query.status) as PostFilters['status'],
            platform: getFirstValue(req.query.platform) as PostFilters['platform'],
            fromDate: parseDate(getFirstValue(req.query.fromDate)) ?? undefined,
            toDate: parseDate(getFirstValue(req.query.toDate)) ?? undefined,
        }

        const result = await this.postsService.getPostsByFilters(userId, filters)

        res.json(result)
    }

    async getPostsByDate(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const fromDateRaw = getFirstValue(req.query.fromDate)
        const toDateRaw = getFirstValue(req.query.toDate)
        const fromDate = parseDate(fromDateRaw)
        const toDate = parseDate(toDateRaw)

        if (!fromDate || !toDate) {
            throw new BaseAppError('fromDate and toDate are required', ErrorCode.BAD_REQUEST, 400)
        }

        const result = await this.postsService.getPostsByDate(userId, fromDate, toDate)

        res.json(result)
    }

    async getPostsFailedCount(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const count = await this.postsService.getPostsFailedCount(userId)

        res.json({ count })
    }

    async getFailedPostTargets(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id

        this.logger.debug('User ID: ', { userId })

        if (!userId) throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)

        const result = await this.postsService.getFailedPostTargets(userId)

        this.logger.debug('Failed Targets: ', { result })

        res.json({ targets: result })
    }

    async retryPostTarget(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const postId = req.body?.postId
        const socialAccountId = req.body?.socialAccountId

        if (!postId || !socialAccountId) {
            throw new BaseAppError('postId and socialAccountId are required', ErrorCode.BAD_REQUEST, 400)
        }

        const result = await this.postsService.retryPostTarget(userId, postId, socialAccountId)

        res.json(result)
    }

    async deletePostTarget(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const postId = req.body?.postId
        const socialAccountId = req.body?.socialAccountId

        if (!postId || !socialAccountId) {
            throw new BaseAppError('postId and socialAccountId are required', ErrorCode.BAD_REQUEST, 400)
        }

        await this.postsService.deletePostTarget(userId, postId, socialAccountId)

        res.status(204).end()
    }

    async getRateLimits(_req: Request, res: Response, _next: NextFunction): Promise<void> {
        res.json({ limits: null })
    }
}
