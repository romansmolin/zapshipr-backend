import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { PostStatus } from '@/modules/post/types/posts.types'

import type {
    IPostsService,
    MediaCompatibilityError,
    PostCreateQueuedResponse,
} from '@/modules/post/services/posts/posts-service.interface'
import type { CreatePostsRequest } from '@/modules/post/schemas/posts.schemas'
import type { IUserService } from '@/modules/user/services/user/user.service.interface'
import type { IWorkspaceProfileService } from '@/modules/workspace/services/workspace-profile/workspace-profile.service'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { PostFilters } from '@/modules/post/types/posts.types'
import type { NextFunction, Request, Response } from 'express'

import { createPostsSchema, presignPostUploadsSchema } from '../validation/posts.schemas'
import { hasTimeZoneInfo, parseDateWithTimeZone } from '@/shared/utils/timezone'

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

const parseDate = (value: unknown, timeZone?: string | null): Date | null => {
    if (value instanceof Date) return value
    if (typeof value === 'number' && !Number.isNaN(value)) {
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed
        }
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const numericValue = Number(value)
        if (!Number.isNaN(numericValue) && numericValue > 0) {
            const parsed = new Date(numericValue)
            if (!Number.isNaN(parsed.getTime())) {
                return parsed
            }
        }

        const trimmed = value.trim()
        if (timeZone && !hasTimeZoneInfo(trimmed)) {
            const parsed = parseDateWithTimeZone(trimmed, timeZone)
            if (parsed && !Number.isNaN(parsed.getTime())) {
                return parsed
            }
        } else {
            const parsed = new Date(trimmed)
            if (!Number.isNaN(parsed.getTime())) {
                return parsed
            }
        }
    }
    return null
}

const parseFilterDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value

    if (typeof value === 'number' && !Number.isNaN(value)) {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    if (typeof value !== 'string' || value.trim() === '') {
        return null
    }

    const trimmed = value.trim()

    const tzMatch = trimmed.match(
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(?:Z|[+-]\d{2}:\d{2})$/
    )

    if (tzMatch?.[1]) {
        const parsed = new Date(`${tzMatch[1]}Z`)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    return parseDate(trimmed)
}

const clampPagination = (value: unknown, min: number, max: number): number | undefined => {
    const num = Number(getFirstValue(value))
    if (!Number.isFinite(num)) return undefined
    return Math.min(max, Math.max(min, Math.trunc(num)))
}

const parseCreatePostsRequest = (body: Request['body']): CreatePostsRequest => {
    const posts = parseJson<CreatePostsRequest['posts']>(body.posts) ?? []
    const copyDataUrls = parseJson<string[]>(body.copyDataUrls) ?? undefined
    const mediaTransforms = parseJson<CreatePostsRequest['mediaTransforms']>(body.mediaTransforms) ?? undefined
    const uploadedMedia = parseJson<CreatePostsRequest['uploadedMedia']>(body.uploadedMedia) ?? undefined
    const timezone = typeof body.timezone === 'string' && body.timezone.trim() !== '' ? body.timezone.trim() : null
    const scheduledAtLocal =
        typeof body.scheduledAtLocal === 'string' && body.scheduledAtLocal.trim() !== ''
            ? body.scheduledAtLocal.trim()
            : null
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
        scheduledAtLocal,
        timezone,
        mainCaption: body.mainCaption ?? null,
        coverTimestamp: Number.isNaN(coverTimestamp as number)
            ? undefined
            : (coverTimestamp as number | undefined),
        copyDataUrls,
        mediaTransforms,
        uploadedMedia,
    }
}

const isCompatibilityError = (value: unknown): value is MediaCompatibilityError => {
    return Boolean(value && typeof value === 'object' && 'ok' in value && (value as { ok?: boolean }).ok === false)
}

const isQueuedResponse = (value: unknown): value is PostCreateQueuedResponse => {
    return Boolean(
        value && typeof value === 'object' && 'queued' in value && (value as { queued?: boolean }).queued === true
    )
}

const extractMediaFileSizes = (
    files: Request['files'],
    payload: CreatePostsRequest
): Array<{ sizeBytes: number }> => {
    let mediaFiles: Express.Multer.File[] = []

    if (files) {
        if (Array.isArray(files)) {
            mediaFiles = files
        } else {
            mediaFiles = Object.entries(files)
                .filter(([fieldName]) => fieldName !== 'coverImage')
                .flatMap(([, fs]) => fs)
        }
    }

    return [
        ...mediaFiles.map((file) => ({ sizeBytes: file.size })),
        ...(payload.uploadedMedia ?? []).map((media) => ({
            sizeBytes: Math.max(0, media.size ?? 0),
        })),
        ...(payload.copyDataUrls ?? []).map(() => ({ sizeBytes: 0 })),
    ]
}

const computeIsScheduled = (payload: CreatePostsRequest): boolean => {
    if (payload.postStatus === PostStatus.DRAFT) return false
    if (payload.postNow === true) return false
    return !!payload.scheduledAtLocal && !!payload.timezone
}

export class PostsController {
    private readonly postsService: IPostsService
    private readonly userService: IUserService
    private readonly workspaceProfileService: IWorkspaceProfileService
    private readonly logger: ILogger

    constructor(
        postsService: IPostsService,
        userService: IUserService,
        workspaceProfileService: IWorkspaceProfileService,
        logger: ILogger
    ) {
        this.postsService = postsService
        this.userService = userService
        this.workspaceProfileService = workspaceProfileService
        this.logger = logger
    }

    private getWorkspaceId(req: Request): string {
        const workspaceId = req.workspaceId
        if (!workspaceId) {
            throw new BaseAppError('Workspace ID is required', ErrorCode.BAD_REQUEST, 400)
        }
        return workspaceId
    }

    private async recordCreateSignals(
        workspaceId: string,
        postId: string,
        payload: CreatePostsRequest,
        isScheduled: boolean
    ): Promise<void> {
        if (payload.posts.length === 0) return

        try {
            const tasks = payload.posts.flatMap((target) => [
                this.workspaceProfileService.recordSignal(workspaceId, {
                    type: 'content_published',
                    source: 'post_service',
                    data: {
                        platform: target.platform,
                        contentLength: target.text?.length || 0,
                        hasMedia: payload.postType === 'media',
                        isScheduled,
                    },
                }),
                this.workspaceProfileService.recordSignal(workspaceId, {
                    type: 'platform_used',
                    source: 'post_service',
                    data: { platform: target.platform },
                }),
            ])

            await Promise.all(tasks)

            this.logger.info('Post signals recorded', {
                operation: 'PostsController.recordCreateSignals',
                postId,
                workspaceId,
                signalCount: payload.posts.length * 2,
            })
        } catch (error) {
            this.logger.warn('Failed to record post signals', {
                operation: 'PostsController.recordCreateSignals',
                postId,
                workspaceId,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async createPost(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const payload = createPostsSchema.parse(parseCreatePostsRequest(req.body))
        const medias = req.files as { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]

        if (payload.postType === 'media') {
            const projectedUploads = extractMediaFileSizes(req.files, payload)
            await this.userService.assertPostMediaUploadAllowed(userId, projectedUploads)
        }

        const result = await this.postsService.createPost(payload, medias, userId, workspaceId)

        if (isCompatibilityError(result)) {
            res.status(result.status).json(result)
            return
        }

        const isScheduled = isQueuedResponse(result) ? false : computeIsScheduled(payload)
        await this.recordCreateSignals(workspaceId, result.postId, payload, isScheduled)

        if (isQueuedResponse(result)) {
            this.logger.info('Post accepted for async processing', {
                operation: 'PostsController.createPost',
                userId,
                postId: result.postId,
                status: result.status,
            })

            res.status(202).json(result)
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

    async createPresignedUploads(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const payload = presignPostUploadsSchema.parse(req.body)

        await this.userService.assertPostMediaUploadAllowed(
            userId,
            payload.files.map((file) => ({ sizeBytes: file.size }))
        )

        const urls = await this.postsService.createPresignedUploadUrls(userId, workspaceId, payload.files)

        res.status(201).json({ items: urls })
    }

    async editPost(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const { postId } = req.params
        if (!postId) {
            throw new BaseAppError('Post ID is required', ErrorCode.BAD_REQUEST, 400)
        }

        const payload = createPostsSchema.parse(parseCreatePostsRequest(req.body))
        const file = req.file

        if (file && payload.postType === 'media') {
            await this.userService.assertPostMediaUploadAllowed(userId, [{ sizeBytes: file.size }])
        }

        await this.postsService.editPost(postId, payload, file, userId, workspaceId)

        this.logger.info('Post updated', {
            operation: 'PostsController.editPost',
            userId,
            workspaceId,
            postId,
        })

        res.status(204).end()
    }

    async deletePost(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const { postId } = req.params
        if (!postId) {
            throw new BaseAppError('Post ID is required', ErrorCode.BAD_REQUEST, 400)
        }

        await this.postsService.deletePost(postId, userId, workspaceId)

        res.status(204).end()
    }

    async getPostsByFilters(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)

        const workspaceId = this.getWorkspaceId(req)

        const filters: PostFilters = {
            page: clampPagination(req.query.page, 1, 100000) ?? undefined,
            limit: clampPagination(req.query.limit, 1, 100) ?? undefined,
            status: getFirstValue(req.query.status) as PostFilters['status'],
            platform: getFirstValue(req.query.platform) as PostFilters['platform'],
            fromDate: parseFilterDate(getFirstValue(req.query.fromDate)) ?? undefined,
            toDate: parseFilterDate(getFirstValue(req.query.toDate)) ?? undefined,
        }

        const result = await this.postsService.getPostsByFilters(userId, workspaceId, filters)
        res.json(result)
    }

    async getPostsByDate(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const fromDateRaw = getFirstValue(req.query.fromDate)
        const toDateRaw = getFirstValue(req.query.toDate)
        const fromDate = parseFilterDate(fromDateRaw)
        const toDate = parseFilterDate(toDateRaw)

        if (!fromDate || !toDate) {
            throw new BaseAppError('fromDate and toDate are required', ErrorCode.BAD_REQUEST, 400)
        }

        const result = await this.postsService.getPostsByDate(userId, workspaceId, fromDate, toDate)

        res.json(result)
    }

    async getPostsFailedCount(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const count = await this.postsService.getPostsFailedCount(userId, workspaceId)

        res.json({ failedCount: count, count })
    }

    async getFailedPostTargets(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id

        if (!userId) throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)

        const workspaceId = this.getWorkspaceId(req)
        const result = await this.postsService.getFailedPostTargets(userId, workspaceId)

        res.json({ targets: result })
    }

    async retryPostTarget(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const postId = req.body?.postId
        const socialAccountId = req.body?.socialAccountId

        if (!postId || !socialAccountId) {
            throw new BaseAppError('postId and socialAccountId are required', ErrorCode.BAD_REQUEST, 400)
        }

        const result = await this.postsService.retryPostTarget(userId, workspaceId, postId, socialAccountId)

        res.json(result)
    }

    async deletePostTarget(req: Request, res: Response, _next: NextFunction): Promise<void> {
        const userId = req.user?.id
        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        const workspaceId = this.getWorkspaceId(req)
        const postId = req.body?.postId
        const socialAccountId = req.body?.socialAccountId

        if (!postId || !socialAccountId) {
            throw new BaseAppError('postId and socialAccountId are required', ErrorCode.BAD_REQUEST, 400)
        }

        await this.postsService.deletePostTarget(userId, workspaceId, postId, socialAccountId)

        res.status(204).end()
    }

    async getRateLimits(_req: Request, res: Response, _next: NextFunction): Promise<void> {
        res.json({
            limits: {
                posting: {
                    policy: 'api_only',
                    message: 'Posting limits are defined by social platform APIs',
                },
            },
        })
    }
}
