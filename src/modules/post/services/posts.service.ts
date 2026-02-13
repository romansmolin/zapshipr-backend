import { randomUUID } from 'crypto'
import { mkdir, rmdir, unlink, writeFile } from 'fs/promises'
import * as path from 'path'

import axios from 'axios'
import ffmpeg = require('fluent-ffmpeg')
import sharp from 'sharp'

import { PostTargetEntity } from '@/modules/post/entity/post-target'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { BaseAppError } from '@/shared/errors/base-error'
import { SocialMediaErrorHandler } from '@/shared/social-media-errors'
import { VideoConverter } from '@/shared/video-processor/video-converter'
import { PostStatus } from '@/modules/post/types/posts.types'
import { isValidTimeZone, parseDateWithTimeZone } from '@/shared/utils/timezone'

import type {
    IPostsService,
    MediaCompatibilityError,
    ServiceErrorEnvelope,
    PostCreateQueuedResponse,
    PostPreparationJobPayload,
} from './posts-service.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { ISocialMediaPostSenderService } from '@/modules/social/services/social-media-post-sender.interface'
import type {
    CreatePostsRequest,
    MediaTransformRequest,
    PresignUploadFileRequest,
    PresignedUploadResponseItem,
    SocilaMediaPlatform,
    UploadedMediaRequest,
} from '@/modules/post/schemas/posts.schemas'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { IPostPreparationScheduler, IPostScheduler } from '@/shared/queue'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IWorkspaceProfileService } from '@/modules/workspace/services/workspace-profile.service'
import type {
    CreatePostResponse,
    PostFilters,
    PostTarget,
    PostTargetResponse,
    PostsByDateResponse,
    PostsListResponse,
} from '@/modules/post/types/posts.types'

export class PostsService implements IPostsService {
    private postRepository: IPostsRepository
    private mediaUploader: IMediaUploader
    private logger: ILogger
    private socialMediaPostSender: ISocialMediaPostSenderService
    private videoConverter: VideoConverter
    private errorHandler: SocialMediaErrorHandler
    private postScheduler?: IPostScheduler
    private postPreparationScheduler?: IPostPreparationScheduler
    private workspaceProfileService?: IWorkspaceProfileService

    constructor(
        postRepository: IPostsRepository,
        mediaUploader: IMediaUploader,
        logger: ILogger,
        socialMediaPostSender: ISocialMediaPostSenderService,
        errorHandler: SocialMediaErrorHandler,
        postScheduler?: IPostScheduler,
        postPreparationScheduler?: IPostPreparationScheduler,
        workspaceProfileService?: IWorkspaceProfileService
    ) {
        this.postRepository = postRepository
        this.logger = logger
        this.mediaUploader = mediaUploader
        this.socialMediaPostSender = socialMediaPostSender
        this.videoConverter = new VideoConverter(logger)
        this.errorHandler = errorHandler
        this.postScheduler = postScheduler
        this.postPreparationScheduler = postPreparationScheduler
        this.workspaceProfileService = workspaceProfileService

        this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this))
        this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this))
    }

    private async uploadCoverImage(coverImageFile: Express.Multer.File, userId: string): Promise<string> {
        const coverImageUrl = await this.mediaUploader.upload({
            key: `${userId}/covers/${Date.now()}-${coverImageFile.originalname}`,
            body: coverImageFile.buffer,
            contentType: coverImageFile.mimetype,
        })

        return coverImageUrl
    }

    private createServiceError<K extends 'MEDIA_COMPATIBILITY', D>(
        kind: K,
        code: ErrorCode,
        message: string,
        status: number,
        details: D
    ): ServiceErrorEnvelope<K, D> {
        return {
            ok: false,
            kind,
            code,
            message,
            status,
            errorId: randomUUID(),
            details,
        }
    }

    private getUploadFlowMode(): 'dual' | 'presigned' | 'multipart' {
        const mode = (process.env.POST_UPLOAD_FLOW ?? 'dual').toLowerCase()
        if (mode === 'presigned' || mode === 'multipart') {
            return mode
        }
        return 'dual'
    }

    private isAsyncPostNowEnabled(): boolean {
        return (process.env.POST_NOW_ASYNC_ENABLED ?? 'false').toLowerCase() === 'true'
    }

    private sanitizeExtension(value?: string | null): string | null {
        if (!value) return null
        const normalized = value.trim().toLowerCase().replace(/^\./, '')
        if (!normalized) return null
        if (!/^[a-z0-9]{1,10}$/.test(normalized)) return null
        return normalized
    }

    private resolveExtension(mimeType: string, extension?: string | null): string {
        const sanitized = this.sanitizeExtension(extension)
        if (sanitized) return sanitized
        return this.getFileExtensionFromMimeType(mimeType) ?? 'bin'
    }

    private buildS3UrlFromKey(key: string): string {
        const bucket = process.env.AWS_S3_BUCKET
        if (!bucket) {
            throw new BaseAppError('AWS_S3_BUCKET is required for uploadedMedia references', ErrorCode.UNKNOWN_ERROR, 500)
        }
        return `https://${bucket}.s3.amazonaws.com/${key}`
    }

    private extractUploadedMediaFiles(
        medias: { [fieldname: string]: Express.Multer.File[] } | undefined | Express.Multer.File[]
    ): Express.Multer.File[] {
        if (!medias) {
            return []
        }

        if (Array.isArray(medias)) {
            return medias
        }

        const indexedMediaEntries = Object.entries(medias)
            .map(([fieldName, files]) => {
                const match = /^media\[(\d+)\]$/.exec(fieldName)
                if (!match || fieldName === 'coverImage') {
                    return null
                }

                return {
                    index: Number(match[1]),
                    files,
                }
            })
            .filter((entry): entry is { index: number; files: Express.Multer.File[] } => entry !== null)
            .sort((a, b) => a.index - b.index)

        if (indexedMediaEntries.length > 0) {
            return indexedMediaEntries.flatMap((entry) => entry.files)
        }

        return Object.entries(medias)
            .filter(([fieldName]) => fieldName !== 'coverImage')
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([, files]) => files)
    }

    private getMediaTransforms(createPostsRequest: CreatePostsRequest): MediaTransformRequest[] {
        return createPostsRequest.mediaTransforms ?? []
    }

    private buildAllMediaIndices(mediaCount: number): number[] {
        if (mediaCount <= 0) {
            return []
        }

        return Array.from({ length: mediaCount }, (_, index) => index)
    }

    private collectSelectedMediaIndices(posts: CreatePostsRequest['posts']): Set<number> {
        const selectedMediaIndices = new Set<number>()

        for (const post of posts) {
            if (!post.mediaIndices) {
                continue
            }

            for (const mediaIndex of post.mediaIndices) {
                selectedMediaIndices.add(mediaIndex)
            }
        }

        return selectedMediaIndices
    }

    private normalizePostTargetsMediaIndices(
        request: CreatePostsRequest,
        mediaCount: number
    ): CreatePostsRequest['posts'] {
        if (request.postType !== 'media') {
            return request.posts.map((post) => ({
                ...post,
                mediaIndices: undefined,
            }))
        }

        const validationFields: Array<{ field: string; errorMessageCode: string }> = []
        const defaultMediaIndices = this.buildAllMediaIndices(mediaCount)

        const normalizedPosts = request.posts.map((post, postIndex) => {
            const providedMediaIndices = post.mediaIndices ?? undefined
            const effectiveMediaIndices = providedMediaIndices ?? defaultMediaIndices

            if (providedMediaIndices && providedMediaIndices.length === 0) {
                validationFields.push({
                    field: `posts.${postIndex}.mediaIndices`,
                    errorMessageCode: 'mediaIndices must not be empty for media posts',
                })
            }

            if (providedMediaIndices) {
                const seen = new Set<number>()

                providedMediaIndices.forEach((mediaIndex, mediaIndexIndex) => {
                    if (!Number.isInteger(mediaIndex)) {
                        validationFields.push({
                            field: `posts.${postIndex}.mediaIndices.${mediaIndexIndex}`,
                            errorMessageCode: 'mediaIndices values must be integers',
                        })
                        return
                    }

                    if (mediaIndex < 0) {
                        validationFields.push({
                            field: `posts.${postIndex}.mediaIndices.${mediaIndexIndex}`,
                            errorMessageCode: 'mediaIndices values must be greater than or equal to 0',
                        })
                    }

                    if (seen.has(mediaIndex)) {
                        validationFields.push({
                            field: `posts.${postIndex}.mediaIndices.${mediaIndexIndex}`,
                            errorMessageCode: 'mediaIndices values must be unique',
                        })
                    }

                    if (mediaIndex >= mediaCount) {
                        validationFields.push({
                            field: `posts.${postIndex}.mediaIndices.${mediaIndexIndex}`,
                            errorMessageCode: `mediaIndices value is out of range (max ${Math.max(mediaCount - 1, 0)})`,
                        })
                    }

                    seen.add(mediaIndex)
                })
            }

            return {
                ...post,
                mediaIndices: [...effectiveMediaIndices],
            }
        })

        if (validationFields.length > 0) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                httpCode: 400,
                fields: validationFields,
            })
        }

        return normalizedPosts
    }

    private buildMediaTransformMap(mediaTransforms: MediaTransformRequest[]): Map<number, MediaTransformRequest> {
        const transformMap = new Map<number, MediaTransformRequest>()

        for (const transform of mediaTransforms) {
            if (transformMap.has(transform.mediaIndex)) {
                throw new BaseAppError(
                    `Duplicate media transform for mediaIndex ${transform.mediaIndex}`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            transformMap.set(transform.mediaIndex, transform)
        }

        return transformMap
    }

    private validateMediaTransformsForCreate(
        mediaTransforms: MediaTransformRequest[],
        mediaFiles: Express.Multer.File[]
    ): Map<number, MediaTransformRequest> {
        if (mediaTransforms.length === 0) {
            return new Map()
        }

        if (mediaFiles.length === 0) {
            throw new BaseAppError(
                'mediaTransforms were provided, but no uploaded media files were found',
                ErrorCode.BAD_REQUEST,
                400
            )
        }

        const transformMap = this.buildMediaTransformMap(mediaTransforms)

        for (const [mediaIndex] of transformMap) {
            if (mediaIndex < 0 || mediaIndex >= mediaFiles.length) {
                throw new BaseAppError(
                    `mediaTransforms[${mediaIndex}] is out of range for uploaded media files`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }
        }

        for (const [mediaIndex] of transformMap) {
            const file = mediaFiles[mediaIndex]
            if (!file?.mimetype.startsWith('image/')) {
                throw new BaseAppError(
                    `mediaTransforms[${mediaIndex}] can only be applied to image files`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }
        }

        return transformMap
    }

    private getSingleEditTransform(
        updatePostRequest: CreatePostsRequest,
        selectedMediaIndices: Set<number>,
        file?: Express.Multer.File
    ): MediaTransformRequest | null {
        const mediaTransforms = this.getMediaTransforms(updatePostRequest)
        if (mediaTransforms.length === 0) {
            return null
        }

        if (!file) {
            throw new BaseAppError(
                'mediaTransforms require an uploaded media file in edit mode',
                ErrorCode.BAD_REQUEST,
                400
            )
        }

        const transformMap = this.buildMediaTransformMap(mediaTransforms)
        if (transformMap.size !== 1 || !transformMap.has(0)) {
            throw new BaseAppError(
                'In edit mode, mediaTransforms must contain exactly one transform with mediaIndex 0',
                ErrorCode.BAD_REQUEST,
                400
            )
        }

        if (!file.mimetype.startsWith('image/')) {
            throw new BaseAppError('mediaTransforms can only be applied to image files', ErrorCode.BAD_REQUEST, 400)
        }

        if (!selectedMediaIndices.has(0)) {
            return null
        }

        return transformMap.get(0) ?? null
    }

    private clamp(value: number, min: number, max: number): number {
        if (value < min) return min
        if (value > max) return max
        return value
    }

    private parseRatio(ratio: string): { width: number; height: number } {
        const [widthRaw, heightRaw] = ratio.split(':')
        const width = Number(widthRaw)
        const height = Number(heightRaw)

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new BaseAppError(`Invalid ratio: ${ratio}`, ErrorCode.BAD_REQUEST, 400)
        }

        return { width, height }
    }

    private resolveOutputSize(ratio: string, cropRect: { width: number; height: number }): { width: number; height: number } {
        if (ratio === 'original') {
            const targetWidth = Math.min(1080, cropRect.width)
            return {
                width: targetWidth,
                height: Math.round((targetWidth * cropRect.height) / cropRect.width),
            }
        }

        if (ratio === '1:1') {
            return { width: 1080, height: 1080 }
        }

        if (ratio === '4:5') {
            return { width: 1080, height: 1350 }
        }

        if (ratio === '9:16') {
            return { width: 1080, height: 1920 }
        }

        const parsedRatio = this.parseRatio(ratio)
        return {
            width: 1080,
            height: Math.round((1080 * parsedRatio.height) / parsedRatio.width),
        }
    }

    private resolveTransformRatio(
        transform: MediaTransformRequest,
        sourceWidth: number,
        sourceHeight: number
    ): { width: number; height: number } {
        if (transform.ratio === 'original') {
            return {
                width: sourceWidth,
                height: sourceHeight,
            }
        }

        return this.parseRatio(transform.ratio)
    }

    private computeCropRect(
        transform: MediaTransformRequest,
        sourceWidth: number,
        sourceHeight: number
    ): { width: number; height: number; left: number; top: number } {
        const ratio = this.resolveTransformRatio(transform, sourceWidth, sourceHeight)

        if (sourceWidth <= 0 || sourceHeight <= 0) {
            throw new BaseAppError('Invalid source dimensions in mediaTransforms', ErrorCode.BAD_REQUEST, 400)
        }

        const baseCropWidth = Math.min(sourceWidth, (sourceHeight * ratio.width) / ratio.height)
        const baseCropHeight = Math.min(sourceHeight, (sourceWidth * ratio.height) / ratio.width)

        const cropWidth = this.clamp(Math.round(baseCropWidth / transform.crop.scale), 1, sourceWidth)
        const cropHeight = this.clamp(Math.round(baseCropHeight / transform.crop.scale), 1, sourceHeight)
        const clampedX = this.clamp(transform.crop.x, -1, 1)
        const clampedY = this.clamp(transform.crop.y, -1, 1)
        const left = Math.round(((1 - clampedX) / 2) * (sourceWidth - cropWidth))
        const top = Math.round(((1 - clampedY) / 2) * (sourceHeight - cropHeight))

        return {
            width: cropWidth,
            height: cropHeight,
            left,
            top,
        }
    }

    private getImageTransformOutputConfig(mimeType: string): { extension: string; mimeType: string } {
        if (mimeType === 'image/png') {
            return {
                extension: 'png',
                mimeType: 'image/png',
            }
        }

        return {
            extension: 'jpg',
            mimeType: 'image/jpeg',
        }
    }

    private getFileExtensionFromMimeType(contentType: string): string | null {
        const extensionByMimeType: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
        }

        return extensionByMimeType[contentType] ?? null
    }

    private updateFilenameExtension(filename: string, contentType: string): string {
        const extension = this.getFileExtensionFromMimeType(contentType)
        if (!extension) {
            return filename
        }

        if (filename.includes('.')) {
            return filename.replace(/\.[^.]+$/, `.${extension}`)
        }

        return `${filename}.${extension}`
    }

    private async transformImageWithFFmpeg(
        imageBuffer: Buffer,
        mimeType: string,
        transform: MediaTransformRequest
    ): Promise<{ buffer: Buffer; contentType: string }> {
        const outputConfig = this.getImageTransformOutputConfig(mimeType)
        const frontendSourceWidth = Math.round(transform.source.width)
        const frontendSourceHeight = Math.round(transform.source.height)

        if (frontendSourceWidth <= 0 || frontendSourceHeight <= 0) {
            throw new BaseAppError('Invalid source dimensions in mediaTransforms', ErrorCode.BAD_REQUEST, 400)
        }

        try {
            const orientedImage = sharp(imageBuffer, { failOn: 'none' }).rotate()
            const metadata = await orientedImage.metadata()
            const actualWidth = metadata.width ?? 0
            const actualHeight = metadata.height ?? 0

            if (actualWidth <= 0 || actualHeight <= 0) {
                throw new BaseAppError('Failed to read image dimensions for mediaTransforms', ErrorCode.BAD_REQUEST, 400)
            }

            const cropRect = this.computeCropRect(transform, actualWidth, actualHeight)
            const outputSize = this.resolveOutputSize(transform.ratio, cropRect)

            this.logger.debug('Resolved media transform', {
                operation: 'transformImageWithFFmpeg',
                ratio: transform.ratio,
                crop: transform.crop,
                source: transform.source,
                actualSource: {
                    width: actualWidth,
                    height: actualHeight,
                },
                cropRect,
                outputSize,
            })

            let transformed = orientedImage.extract(cropRect).resize(outputSize.width, outputSize.height, {
                fit: 'fill',
                kernel: sharp.kernel.lanczos3,
            })

            if (outputConfig.extension === 'png') {
                transformed = transformed.png()
            } else {
                transformed = transformed.jpeg({ quality: 90 })
            }

            const transformedBuffer = await transformed.toBuffer()

            return {
                buffer: transformedBuffer,
                contentType: outputConfig.mimeType,
            }
        } catch (error) {
            throw new BaseAppError(
                `Failed to apply media transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCode.BAD_REQUEST,
                400
            )
        }
    }

    private validateMediaCompatibility(
        createPostsRequest: CreatePostsRequest,
        medias: { [fieldname: string]: Express.Multer.File[] } | undefined | Express.Multer.File[]
    ): MediaCompatibilityError | null {
        if (createPostsRequest.postType !== 'media') {
            return null
        }

        const mediaFiles = this.extractUploadedMediaFiles(medias)
        const uploadedMedia = createPostsRequest.uploadedMedia ?? []
        const copyDataUrls = createPostsRequest.copyDataUrls ?? []
        const hasVideo =
            mediaFiles.some((file) => file.mimetype.startsWith('video/')) ||
            uploadedMedia.some((media) => media.type.startsWith('video/')) ||
            copyDataUrls.some((url) => {
                const mimeType = this.getFileMimeTypeFromURL(url, true)
                return Boolean(mimeType?.startsWith('video/'))
            })
        const hasImage =
            mediaFiles.some((file) => file.mimetype.startsWith('image/')) ||
            uploadedMedia.some((media) => media.type.startsWith('image/')) ||
            copyDataUrls.some((url) => {
                const mimeType = this.getFileMimeTypeFromURL(url, true)
                return Boolean(mimeType?.startsWith('image/'))
            })

        if (!hasVideo && !hasImage) {
            return null
        }

        const incompatibleAccounts: Array<{ accountId: string; platform: string; reason: string }> = []

        for (const post of createPostsRequest.posts) {
            const platform = post.platform.toLowerCase()

            if (hasVideo && platform === 'bluesky') {
                incompatibleAccounts.push({
                    accountId: post.account,
                    platform: 'bluesky',
                    reason: 'Bluesky does not support video posts. Only images are supported.',
                })
            }
        }

        if (incompatibleAccounts.length > 0) {
            return this.createServiceError(
                'MEDIA_COMPATIBILITY',
                ErrorCode.CONTENT_VALIDATION_FAILED,
                'Some selected accounts do not support the media type you are trying to publish.',
                400,
                {
                    incompatibleAccounts,
                }
            )
        }

        return null
    }

    private async validateVideoDuration(
        file: Express.Multer.File,
        createPostsRequest: CreatePostsRequest
    ): Promise<void> {
        const hasInstagramTarget = createPostsRequest.posts.some((post) => post.platform === 'instagram')

        if (!hasInstagramTarget) {
            return
        }

        try {
            const tempDir = await this.createTempDir()
            const tempFilePath = path.join(tempDir, `temp-${Date.now()}.${file.originalname.split('.').pop()}`)

            await this.writeBufferToFile(file.buffer, tempFilePath)

            const videoInfo = await this.getVideoDuration(tempFilePath)

            await this.cleanupTempFiles([tempFilePath], tempDir)

            if (videoInfo.duration < 3) {
                throw new BaseAppError(
                    `Video duration is too short for Instagram Reels. Minimum duration is 3 seconds, but your video is ${videoInfo.duration.toFixed(2)} seconds.`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            this.logger.info('Video duration validation passed', {
                operation: 'validateVideoDuration',
                duration: videoInfo.duration,
                fileName: file.originalname,
                platform: 'instagram',
            })
        } catch (error) {
            if (error instanceof BaseAppError) {
                throw error
            }

            this.logger.warn('Video duration validation failed, allowing upload', {
                operation: 'validateVideoDuration',
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
                fileName: file.originalname,
            })
        }
    }

    private async getVideoDuration(videoPath: string): Promise<{ duration: number }> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err)
                    return
                }

                const duration = metadata.format.duration || 0
                resolve({ duration })
            })
        })
    }

    private async createTempDir(): Promise<string> {
        const tempDir = path.join(process.cwd(), 'temp', 'video-validation', `validation-${Date.now()}`)
        await mkdir(tempDir, { recursive: true })
        return tempDir
    }

    private async writeBufferToFile(buffer: Buffer, filePath: string): Promise<void> {
        await writeFile(filePath, buffer)
    }

    private async cleanupTempFiles(filePaths: string[], dir?: string): Promise<void> {
        for (const filePath of filePaths) {
            try {
                await unlink(filePath)
            } catch (error) {
                this.logger.warn('Failed to cleanup temporary file', {
                    filePath,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                })
            }
        }

        if (dir) {
            try {
                await rmdir(dir)
            } catch (error) {
                this.logger.warn('Failed to cleanup temporary directory', {
                    dir,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                })
            }
        }
    }

    private getFileMimeTypeFromURL(url: string, returnMimeType = false): string | null {
        const pathname = new URL(url).pathname
        const ext = pathname.split('.').pop()?.toLowerCase()

        if (!ext) return null

        if (!returnMimeType) {
            return ext
        }

        const mimeTypes: Record<string, string> = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
        }

        return mimeTypes[ext] || `application/octet-stream`
    }

    private buildSafeFilenameFromUrl(url: string, index: number): string {
        try {
            const pathname = new URL(url).pathname
            const decoded = decodeURIComponent(pathname.split('/').pop() || '')
            const base = decoded
                .replace(/[^a-zA-Z0-9._-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
            if (base) return `${Date.now()}-${index}-${base}`
        } catch (_) {
            // fallback handled below
        }
        return `${Date.now()}-${index}-media`
    }

    private buildSafeFilename(originalName: string, index: number, fallbackExt?: string): string {
        const name = decodeURIComponent(originalName || '').trim()
        const hasExt = name.includes('.')
        const safe = name
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
        const ext = hasExt ? '' : fallbackExt ? `.${fallbackExt}` : ''
        const base = safe || `media${ext}`
        return `${Date.now()}-${index}-${base}`
    }

    private async uploadAndSaveMediaFiles(
        medias: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined,
        userId: string,
        postId: string,
        createPostsRequest: CreatePostsRequest,
        copyDataUrls?: string[] | null,
        selectedMediaIndices?: Set<number>
    ): Promise<void> {
        const mediaFiles = this.extractUploadedMediaFiles(medias)
        const copyMediaCount = copyDataUrls?.length ?? 0
        const mediaTransformMap = this.validateMediaTransformsForCreate(
            this.getMediaTransforms(createPostsRequest),
            mediaFiles
        )
        let orderCounter = 1

        if (copyDataUrls && copyDataUrls.length > 0) {
            const copyTasks = copyDataUrls.map(async (copyUrl, idx) => {
                const order = orderCounter + idx
                const safeName = this.buildSafeFilenameFromUrl(copyUrl, idx)
                try {
                    const response = await axios.get<ArrayBuffer>(copyUrl, { responseType: 'arraybuffer' })
                    const buffer = Buffer.from(response.data)
                    const mimeType =
                        response.headers['content-type'] ||
                        this.getFileMimeTypeFromURL(copyUrl, true) ||
                        `application/octet-stream`

                    const mediaUrl = await this.mediaUploader.upload({
                        key: `${userId}/posts/${safeName}`,
                        body: buffer,
                        contentType: mimeType,
                    })

                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: mediaUrl,
                        type: mimeType,
                    })

                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, order)

                    this.logger.info('Attached copied media asset to post', {
                        operation: 'uploadAndSaveMediaFiles',
                        userId,
                        postId,
                        mediaId,
                        sourceIndex: idx,
                        mimeType,
                        order,
                    })
                } catch (error) {
                    this.logger.warn('Failed to re-upload copied media, falling back to source URL', {
                        operation: 'uploadAndSaveMediaFiles',
                        userId,
                        postId,
                        copyUrl,
                        error:
                            error instanceof Error
                                ? { name: error.name, code: 'COPY_UPLOAD_FAILED', stack: error.message }
                                : { name: 'UnknownError', code: 'COPY_UPLOAD_FAILED' },
                    })

                    const mimeType = this.getFileMimeTypeFromURL(copyUrl, true) || `application/octet-stream`
                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: copyUrl,
                        type: mimeType,
                    })
                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, order)
                }
            })

            await Promise.all(copyTasks)
            orderCounter += copyDataUrls.length
        }

        if (mediaFiles.length > 0) {
            for (let index = 0; index < mediaFiles.length; index++) {
                const file = mediaFiles[index]
                let processedBuffer = file.buffer
                let contentType = file.mimetype
                let originalName = this.buildSafeFilename(
                    file.originalname,
                    orderCounter,
                    file.mimetype.split('/')[1]
                )
                const shouldApplyTransform =
                    !selectedMediaIndices || selectedMediaIndices.has(copyMediaCount + index)
                const mediaTransform = shouldApplyTransform ? mediaTransformMap.get(index) : undefined

                if (mediaTransform) {
                    const transformedImage = await this.transformImageWithFFmpeg(processedBuffer, contentType, mediaTransform)
                    processedBuffer = transformedImage.buffer
                    contentType = transformedImage.contentType
                    originalName = this.updateFilenameExtension(originalName, contentType)
                }

                if (file.mimetype.includes('video')) {
                    await this.validateVideoDuration(file, createPostsRequest)
                }

                if (file.mimetype.includes('video') && this.videoConverter.needsConversion(file.mimetype, 'mp4')) {
                    this.logger.info('Converting video to MP4', {
                        operation: 'uploadAndSaveMediaFiles',
                        originalMimeType: file.mimetype,
                        originalName: file.originalname,
                    })

                    try {
                        processedBuffer = await this.videoConverter.convertVideo(file.buffer, {
                            targetFormat: 'mp4',
                            quality: 'medium',
                            maxFileSize: 50 * 1024 * 1024,
                        })
                        contentType = this.videoConverter.getMimeTypeForFormat('mp4')

                        originalName = originalName.replace(/\.(mov|MOV|webm|WEBM)$/, '.mp4')

                        this.logger.info('Video conversion completed', {
                            operation: 'uploadAndSaveMediaFiles',
                            originalSize: file.buffer.length,
                            convertedSize: processedBuffer.length,
                            newMimeType: contentType,
                            newName: originalName,
                        })
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                        this.logger.error('Video conversion failed, using original file', {
                            operation: 'uploadAndSaveMediaFiles',
                            error: { name: 'VideoConversionError', stack: errorMessage },
                            originalMimeType: file.mimetype,
                        })
                        processedBuffer = file.buffer
                        contentType = file.mimetype
                    }
                }

                const mediaUrl = await this.mediaUploader.upload({
                    key: `${userId}/posts/${originalName}`,
                    body: processedBuffer,
                    contentType: contentType,
                })

                const { mediaId } = await this.postRepository.savePostMediaAssets({
                    userId,
                    url: mediaUrl,
                    type: contentType,
                })

                await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)

                this.logger.info('Successfully uploaded media', {
                    operation: 'createPost',
                    userId,
                    postId,
                    mediaId,
                    index: orderCounter - 1,
                    totalFiles: mediaFiles.length + (copyDataUrls?.length ?? 0),
                    contentType,
                    originalName,
                })
            }
        }
    }

    private async saveUploadedMediaReferences(
        uploadedMedia: UploadedMediaRequest[],
        userId: string,
        postId: string,
        orderCounter: number
    ): Promise<number> {
        for (const media of uploadedMedia) {
            const mediaUrl = media.url ?? this.buildS3UrlFromKey(media.key)
            const { mediaId } = await this.postRepository.savePostMediaAssets({
                userId,
                url: mediaUrl,
                type: media.type,
            })

            await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)
        }

        return orderCounter
    }

    private async saveCopyMediaReferences(
        copyDataUrls: string[] | null | undefined,
        userId: string,
        postId: string,
        orderCounter: number
    ): Promise<number> {
        if (!copyDataUrls?.length) {
            return orderCounter
        }

        for (const copyUrl of copyDataUrls) {
            const mimeType = this.getFileMimeTypeFromURL(copyUrl, true) || 'application/octet-stream'
            const { mediaId } = await this.postRepository.savePostMediaAssets({
                userId,
                url: copyUrl,
                type: mimeType,
            })
            await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)
        }

        return orderCounter
    }

    private async saveMultipartMediaWithoutTransforms(
        medias: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined,
        userId: string,
        postId: string,
        orderCounter: number
    ): Promise<number> {
        const mediaFiles = this.extractUploadedMediaFiles(medias)
        if (mediaFiles.length === 0) {
            return orderCounter
        }

        for (let index = 0; index < mediaFiles.length; index++) {
            const file = mediaFiles[index]
            const fallbackExtension = this.getFileExtensionFromMimeType(file.mimetype) ?? 'bin'
            const fileName = this.buildSafeFilename(file.originalname, orderCounter + index, fallbackExtension)
            const mediaUrl = await this.mediaUploader.upload({
                key: `${userId}/posts/${fileName}`,
                body: file.buffer,
                contentType: file.mimetype,
            })

            const { mediaId } = await this.postRepository.savePostMediaAssets({
                userId,
                url: mediaUrl,
                type: file.mimetype,
            })

            await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)
        }

        return orderCounter
    }

    private async attachMediaReferencesForAsyncPostNow(
        medias: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined,
        request: CreatePostsRequest,
        userId: string,
        postId: string
    ): Promise<void> {
        let orderCounter = 1
        orderCounter = await this.saveCopyMediaReferences(request.copyDataUrls, userId, postId, orderCounter)
        orderCounter = await this.saveUploadedMediaReferences(request.uploadedMedia ?? [], userId, postId, orderCounter)
        await this.saveMultipartMediaWithoutTransforms(medias, userId, postId, orderCounter)
    }

    private async enqueuePostPreparation(payload: PostPreparationJobPayload): Promise<void> {
        const scheduler = this.requirePostPreparationScheduler()
        const startedAt = Date.now()
        await scheduler.schedulePostPreparation(payload)
        this.logger.info('post_queue_enqueue_ms', {
            operation: 'enqueuePostPreparation',
            postId: payload.postId,
            userId: payload.userId,
            metric: 'post_queue_enqueue_ms',
            value: Date.now() - startedAt,
        })
    }

    private async applyMediaTransformsToStoredAssets(
        payload: PostPreparationJobPayload
    ): Promise<void> {
        const mediaTransforms = payload.mediaTransforms
        if (mediaTransforms.length === 0) {
            return
        }

        const selectedMediaSet = new Set(payload.selectedMediaIndices)
        const mediaAssets = await this.postRepository.getPostMediaAssets(payload.postId)

        for (const transform of mediaTransforms) {
            if (selectedMediaSet.size > 0 && !selectedMediaSet.has(transform.mediaIndex)) {
                continue
            }

            const mediaAsset = mediaAssets[transform.mediaIndex]
            if (!mediaAsset) {
                throw new BaseAppError(
                    `mediaTransforms[${transform.mediaIndex}] is out of range for stored media assets`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            if (!mediaAsset.type?.startsWith('image/')) {
                throw new BaseAppError(
                    `mediaTransforms[${transform.mediaIndex}] can only be applied to image media assets`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            if (!mediaAsset.mediaId) {
                throw new BaseAppError(
                    `mediaTransforms[${transform.mediaIndex}] cannot be applied because media asset ID is missing`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            const downloadResponse = await axios.get<ArrayBuffer>(mediaAsset.url, {
                responseType: 'arraybuffer',
            })
            const sourceBuffer = Buffer.from(downloadResponse.data)
            const transformedImage = await this.transformImageWithFFmpeg(sourceBuffer, mediaAsset.type, transform)
            const extension = this.getFileExtensionFromMimeType(transformedImage.contentType) ?? 'jpg'
            const transformedKey = `${payload.userId}/posts/transformed/${payload.postId}-${transform.mediaIndex}-${Date.now()}.${extension}`
            const transformedUrl = await this.mediaUploader.upload({
                key: transformedKey,
                body: transformedImage.buffer,
                contentType: transformedImage.contentType,
            })

            await this.postRepository.updateMediaAsset(mediaAsset.mediaId, {
                url: transformedUrl,
                type: transformedImage.contentType,
            })
        }
    }

    private requirePostScheduler(): IPostScheduler {
        if (!this.postScheduler) {
            throw new BaseAppError('Post scheduler is not configured', ErrorCode.UNKNOWN_ERROR, 500)
        }

        return this.postScheduler
    }

    private requirePostPreparationScheduler(): IPostPreparationScheduler {
        if (!this.postPreparationScheduler) {
            throw new BaseAppError('Post preparation scheduler is not configured', ErrorCode.UNKNOWN_ERROR, 500)
        }

        return this.postPreparationScheduler
    }

    private async schedulePostTargets(
        postId: string,
        userId: string,
        scheduledTime: Date,
        targets: PostTarget[]
    ): Promise<void> {
        if (targets.length === 0) return

        const scheduler = this.requirePostScheduler()

        await Promise.all(
            targets.map((target) =>
                scheduler.schedulePost(target.platform, postId, userId, scheduledTime, target.socialAccountId)
            )
        )
    }

    private async cleanupScheduledJobs(
        postId: string,
        platforms: Iterable<SocilaMediaPlatform>,
        throwOnError: boolean
    ): Promise<void> {
        if (!this.postScheduler) {
            return
        }

        const uniquePlatforms = Array.from(new Set(platforms))
        if (uniquePlatforms.length === 0) return

        const results = await Promise.allSettled(
            uniquePlatforms.map((platform) => this.postScheduler!.cleanupJobsForDeletedPost(platform, postId))
        )

        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

        if (failures.length > 0) {
            this.logger.error('Failed to cleanup scheduled jobs', {
                operation: 'cleanupScheduledJobs',
                postId,
                platforms: uniquePlatforms,
                failureCount: failures.length,
            })

            if (throwOnError) {
                throw new BaseAppError('Failed to cleanup scheduled jobs', ErrorCode.UNKNOWN_ERROR, 500)
            }
        }
    }

    private resolveScheduledTime(scheduledAtLocal?: string | null, timezone?: string | null): Date | null {
        if (!scheduledAtLocal || !timezone) return null
        if (!isValidTimeZone(timezone)) return null
        return parseDateWithTimeZone(scheduledAtLocal, timezone)
    }

    private async enqueueImmediatePostTargets(
        postId: string,
        userId: string,
        postTargets: PostTarget[],
        mainCaption?: string | null
    ): Promise<void> {
        try {
            await this.schedulePostTargets(postId, userId, new Date(), postTargets)

            this.logger.info('Immediate post queued for background publishing', {
                operation: 'enqueueImmediatePostTargets',
                userId,
                postId,
                targetCount: postTargets.length,
            })
        } catch (error) {
            await this.cleanupScheduledJobs(
                postId,
                postTargets.map((target) => target.platform),
                false
            )

            await this.postRepository.updateBasePost(postId, userId, PostStatus.FAILED, mainCaption ?? null)

            this.logger.error('Failed to enqueue immediate post targets', {
                operation: 'enqueueImmediatePostTargets',
                userId,
                postId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to enqueue immediate post targets', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    private async sendImmediatePostSynchronously(
        postId: string,
        userId: string,
        createPostsRequest: CreatePostsRequest
    ): Promise<void> {
        this.logger.info('Starting immediate post sending', {
            operation: 'sendImmediatePostSynchronously',
            userId,
            postId,
            postCount: createPostsRequest.posts.length,
            platforms: createPostsRequest.posts.map((p) => p.platform),
        })

        const targetsByPlatform = createPostsRequest.posts.reduce(
            (acc, target) => {
                if (!acc[target.platform]) {
                    acc[target.platform] = []
                }
                acc[target.platform].push(target)
                return acc
            },
            {} as Record<string, CreatePostsRequest['posts']>
        )

        const sendingPromises = Object.entries(targetsByPlatform).map(([platform, targets]) => {
            return Promise.all(
                targets.map(async (target) => {
                    try {
                        await this.socialMediaPostSender.sendPost(
                            userId,
                            postId,
                            platform as SocilaMediaPlatform,
                            target.account
                        )
                        return { success: true, target }
                    } catch (error) {
                        return { success: false, target, error }
                    }
                })
            )
        })

        const results = await Promise.allSettled(sendingPromises)
        const allTargetResults: Array<{ target: { account: string }; success: boolean; error?: unknown }> = []

        results.forEach((platformResult, platformIndex) => {
            if (platformResult.status === 'fulfilled') {
                const targetResults = platformResult.value

                targetResults.forEach((targetResult) => {
                    allTargetResults.push({
                        target: targetResult.target,
                        success: targetResult.success,
                        error: targetResult.error,
                    })
                })
            } else {
                const platformTargets = Object.values(targetsByPlatform)[platformIndex]
                platformTargets.forEach((target) => {
                    allTargetResults.push({
                        target,
                        success: false,
                        error: platformResult.reason,
                    })
                })
            }
        })

        const failures = allTargetResults.filter((item) => !item.success)
        const successes = allTargetResults.filter((item) => item.success)

        if (failures.length > 0) {
            await Promise.all(
                failures.map(async ({ target, error }) => {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

                    await this.postRepository.updatePostTarget(
                        userId,
                        postId,
                        target.account,
                        PostStatus.FAILED,
                        errorMessage
                    )
                })
            )
        }

        if (successes.length > 0) {
            await Promise.all(
                successes.map(async ({ target }) => {
                    await this.postRepository.updatePostTarget(userId, postId, target.account, PostStatus.DONE)
                })
            )
        }

        if (failures.length === createPostsRequest.posts.length) {
            await this.postRepository.updateBasePost(
                postId,
                userId,
                PostStatus.FAILED,
                createPostsRequest.mainCaption ?? null
            )

            this.logger.error('All immediate posts failed to send', {
                operation: 'sendImmediatePostSynchronously',
                postId,
                userId,
                failureCount: failures.length,
                totalPosts: createPostsRequest.posts.length,
                errors: failures.map((f) => (f.error instanceof Error ? f.error.message : 'Unknown error')),
            })
        } else if (successes.length === createPostsRequest.posts.length) {
            await this.postRepository.updateBasePost(
                postId,
                userId,
                PostStatus.DONE,
                createPostsRequest.mainCaption ?? null
            )

            this.logger.info('All immediate posts sent successfully', {
                operation: 'sendImmediatePostSynchronously',
                postId,
                userId,
                successCount: successes.length,
                totalPosts: createPostsRequest.posts.length,
            })
        } else {
            await this.postRepository.updateBasePost(
                postId,
                userId,
                PostStatus.PARTIALLY_DONE,
                createPostsRequest.mainCaption ?? null
            )

            this.logger.warn('Some immediate posts failed to send', {
                operation: 'sendImmediatePostSynchronously',
                postId,
                userId,
                successCount: successes.length,
                failureCount: failures.length,
                totalPosts: createPostsRequest.posts.length,
                errors: failures.map((f) => (f.error instanceof Error ? f.error.message : 'Unknown error')),
            })
        }
    }

    private async recordPostSignals(
        workspaceId: string,
        postId: string,
        postTargets: PostTarget[],
        createPostsRequest: CreatePostsRequest,
        isScheduled: boolean
    ): Promise<void> {
        if (!this.workspaceProfileService || postTargets.length === 0) {
            return
        }

        try {
            const profileService = this.workspaceProfileService
            const signalTasks = postTargets.flatMap((target) => [
                profileService.recordSignal(workspaceId, {
                    type: 'content_published',
                    source: 'post_service',
                    data: {
                        platform: target.platform,
                        contentLength: target.text?.length || 0,
                        hasMedia: createPostsRequest.postType === 'media',
                        isScheduled,
                    },
                }),
                profileService.recordSignal(workspaceId, {
                    type: 'platform_used',
                    source: 'post_service',
                    data: {
                        platform: target.platform,
                    },
                }),
            ])

            await Promise.all(signalTasks)

            this.logger.info('Post signals recorded', {
                operation: 'recordPostSignals',
                postId,
                workspaceId,
                signalCount: postTargets.length * 2,
            })
        } catch (error) {
            this.logger.warn('Failed to record post signals', {
                operation: 'recordPostSignals',
                postId,
                workspaceId,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async createPresignedUploadUrls(
        userId: string,
        workspaceId: string,
        files: PresignUploadFileRequest[]
    ): Promise<PresignedUploadResponseItem[]> {
        const expiresIn = 15 * 60

        return Promise.all(
            files.map(async (file, index) => {
                const extension = this.resolveExtension(file.mimeType, file.extension)
                const key = `${userId}/posts/staged/${workspaceId}/${Date.now()}-${index}-${randomUUID()}.${extension}`
                return this.mediaUploader.getPresignedUploadUrl({
                    key,
                    contentType: file.mimeType,
                    expiresIn,
                })
            })
        )
    }

    async processPostPreparationJob(payload: PostPreparationJobPayload): Promise<void> {
        const startedAt = Date.now()
        const postDetails = await this.postRepository.getPostDetails(payload.postId, payload.userId)

        if (postDetails.status === PostStatus.DRAFT) {
            return
        }

        try {
            await this.applyMediaTransformsToStoredAssets(payload)

            const postTargets: PostTarget[] = postDetails.targets.map((target) => ({
                ...target,
                postId: payload.postId,
                socialAccountId: target.socialAccountId,
            }))

            await this.schedulePostTargets(payload.postId, payload.userId, new Date(), postTargets)

            this.logger.info('post_preparation_ms', {
                operation: 'processPostPreparationJob',
                postId: payload.postId,
                userId: payload.userId,
                metric: 'post_preparation_ms',
                value: Date.now() - startedAt,
            })
        } catch (error) {
            await this.postRepository.updateBasePost(payload.postId, payload.userId, PostStatus.FAILED, postDetails.mainCaption)
            throw error
        }
    }

    private async rollbackFailedPostCreation(postId: string, userId: string, workspaceId: string): Promise<void> {
        try {
            await this.deletePost(postId, userId, workspaceId)
            this.logger.warn('Rolled back post created during failed createPost flow', {
                operation: 'rollbackFailedPostCreation',
                postId,
                userId,
                workspaceId,
            })
        } catch (cleanupError) {
            this.logger.error('Failed to rollback post after createPost error', {
                operation: 'rollbackFailedPostCreation',
                postId,
                userId,
                workspaceId,
                error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
            })
        }
    }

    async createPost(
        createPostsRequest: CreatePostsRequest,
        medias: { [fieldname: string]: Express.Multer.File[] } | undefined | Express.Multer.File[],
        userId: string,
        workspaceId: string
    ): Promise<CreatePostResponse | MediaCompatibilityError | PostCreateQueuedResponse> {
        let createdPostId: string | null = null

        try {
            const createStartedAt = Date.now()
            const uploadedMediaFiles = this.extractUploadedMediaFiles(medias)
            const copyMediaCount = createPostsRequest.copyDataUrls?.length ?? 0
            const uploadedMediaCount = createPostsRequest.uploadedMedia?.length ?? 0
            const mediaPoolCount =
                createPostsRequest.postType === 'media'
                    ? uploadedMediaFiles.length + copyMediaCount + uploadedMediaCount
                    : 0
            const normalizedCreatePostsRequest: CreatePostsRequest = {
                ...createPostsRequest,
                posts: this.normalizePostTargetsMediaIndices(createPostsRequest, mediaPoolCount),
            }
            const selectedMediaIndices = this.collectSelectedMediaIndices(normalizedCreatePostsRequest.posts)

            const mediaCompatibilityError = this.validateMediaCompatibility(normalizedCreatePostsRequest, medias)
            if (mediaCompatibilityError) {
                return mediaCompatibilityError
            }

            const scheduledUtc = this.resolveScheduledTime(
                normalizedCreatePostsRequest.scheduledAtLocal,
                normalizedCreatePostsRequest.timezone
            )
            const isDraft = normalizedCreatePostsRequest.postStatus === PostStatus.DRAFT
            const isPostNow = !isDraft && normalizedCreatePostsRequest.postNow === true
            const isScheduled = !isDraft && scheduledUtc && !isPostNow
            const scheduledAtLocal = isScheduled ? (normalizedCreatePostsRequest.scheduledAtLocal ?? null) : null
            const scheduledTimezone = isScheduled ? (normalizedCreatePostsRequest.timezone ?? null) : null

            if (isScheduled && scheduledUtc) {
                if (scheduledUtc.getTime() <= Date.now()) {
                    throw new BaseAppError('Scheduled time must be in the future', ErrorCode.BAD_REQUEST, 400)
                }
            }

            let initialStatus = normalizedCreatePostsRequest.postStatus
            if (isScheduled || isPostNow) {
                initialStatus = PostStatus.PENDING
            }

            const useAsyncPostNow = isPostNow && this.isAsyncPostNowEnabled()
            const uploadFlowMode = this.getUploadFlowMode()
            const canUseUploadedMedia =
                uploadFlowMode !== 'multipart' &&
                Array.isArray(normalizedCreatePostsRequest.uploadedMedia) &&
                normalizedCreatePostsRequest.uploadedMedia.length > 0

            let coverImageUrl: string | undefined

            if (medias && typeof medias === 'object' && !Array.isArray(medias)) {
                const coverImageFiles = medias['coverImage']

                if (Array.isArray(coverImageFiles) && coverImageFiles.length > 0) {
                    coverImageUrl = await this.uploadCoverImage(coverImageFiles[0], userId)
                }
            }

            const { postId } = await this.postRepository.createBasePost(
                userId,
                workspaceId,
                initialStatus,
                normalizedCreatePostsRequest.postType,
                scheduledAtLocal,
                scheduledTimezone,
                normalizedCreatePostsRequest.mainCaption ?? null,
                normalizedCreatePostsRequest.coverTimestamp ?? null,
                coverImageUrl
            )
            createdPostId = postId

            if (normalizedCreatePostsRequest.postType === 'media') {
                if (useAsyncPostNow) {
                    const asyncMediaRequest = canUseUploadedMedia
                        ? normalizedCreatePostsRequest
                        : { ...normalizedCreatePostsRequest, uploadedMedia: undefined }
                    await this.attachMediaReferencesForAsyncPostNow(
                        canUseUploadedMedia ? undefined : medias,
                        asyncMediaRequest,
                        userId,
                        postId
                    )
                } else if (medias || normalizedCreatePostsRequest.copyDataUrls) {
                    await this.uploadAndSaveMediaFiles(
                        medias,
                        userId,
                        postId,
                        normalizedCreatePostsRequest,
                        normalizedCreatePostsRequest.copyDataUrls,
                        selectedMediaIndices
                    )
                } else if (canUseUploadedMedia) {
                    let orderCounter = 1
                    orderCounter = await this.saveCopyMediaReferences(
                        normalizedCreatePostsRequest.copyDataUrls,
                        userId,
                        postId,
                        orderCounter
                    )
                    await this.saveUploadedMediaReferences(
                        normalizedCreatePostsRequest.uploadedMedia ?? [],
                        userId,
                        postId,
                        orderCounter
                    )

                    if (this.getMediaTransforms(normalizedCreatePostsRequest).length > 0) {
                        await this.applyMediaTransformsToStoredAssets({
                            postId,
                            userId,
                            workspaceId,
                            mediaTransforms: this.getMediaTransforms(normalizedCreatePostsRequest),
                            selectedMediaIndices: Array.from(selectedMediaIndices),
                        })
                    }
                }
            }

            const postTargets: PostTarget[] = normalizedCreatePostsRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }))

            await this.postRepository.createPostTargets(postTargets)

            if (isScheduled && scheduledUtc) {
                try {
                    await this.schedulePostTargets(postId, userId, scheduledUtc, postTargets)
                } catch (error) {
                    await this.cleanupScheduledJobs(
                        postId,
                        postTargets.map((target) => target.platform),
                        false
                    )

                    await this.postRepository.updateBasePost(
                        postId,
                        userId,
                        PostStatus.FAILED,
                        normalizedCreatePostsRequest.mainCaption ?? null
                    )

                    this.logger.error('Failed to schedule post targets', {
                        operation: 'createPost',
                        postId,
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    })

                    if (error instanceof BaseAppError) {
                        throw error
                    }

                    throw new BaseAppError('Failed to schedule post targets', ErrorCode.UNKNOWN_ERROR, 500)
                }
            }

            if (isPostNow) {
                if (useAsyncPostNow) {
                    await this.enqueuePostPreparation({
                        postId,
                        userId,
                        workspaceId,
                        mediaTransforms: this.getMediaTransforms(normalizedCreatePostsRequest),
                        selectedMediaIndices: Array.from(selectedMediaIndices),
                    })

                    await this.recordPostSignals(
                        workspaceId,
                        postId,
                        postTargets,
                        normalizedCreatePostsRequest,
                        false
                    )

                    this.logger.info('post_create_ack_ms', {
                        operation: 'createPost',
                        postId,
                        userId,
                        metric: 'post_create_ack_ms',
                        value: Date.now() - createStartedAt,
                    })

                    return {
                        postId,
                        status: PostStatus.PENDING,
                        queued: true,
                    }
                }

                if (this.postScheduler) {
                    await this.enqueueImmediatePostTargets(
                        postId,
                        userId,
                        postTargets,
                        normalizedCreatePostsRequest.mainCaption ?? null
                    )
                } else {
                    throw new BaseAppError(
                        'Post scheduler is not configured for immediate publishing',
                        ErrorCode.UNKNOWN_ERROR,
                        500
                    )
                }
            }

            await this.recordPostSignals(workspaceId, postId, postTargets, normalizedCreatePostsRequest, !!isScheduled)

            return await this.postRepository.getPostDetails(postId, userId)
        } catch (error: unknown) {
            if (createdPostId) {
                await this.rollbackFailedPostCreation(createdPostId, userId, workspaceId)
            }

            if (error instanceof AppError) throw error
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to create post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async editPost(
        postId: string,
        updatePostRequest: CreatePostsRequest,
        file: Express.Multer.File | undefined,
        userId: string,
        workspaceId: string
    ): Promise<void> {
        try {
            const oldPost = await this.postRepository.getPostDetails(postId, userId)
            let existingMediaAssets: Awaited<ReturnType<IPostsRepository['getPostMediaAssets']>> = []
            if (updatePostRequest.postType === 'media') {
                existingMediaAssets = await this.postRepository.getPostMediaAssets(postId)
            }
            const mediaPoolCount =
                updatePostRequest.postType === 'media' ? (file ? Math.max(existingMediaAssets.length, 1) : existingMediaAssets.length) : 0
            const normalizedUpdatePostRequest: CreatePostsRequest = {
                ...updatePostRequest,
                posts: this.normalizePostTargetsMediaIndices(updatePostRequest, mediaPoolCount),
            }
            const selectedMediaIndices = this.collectSelectedMediaIndices(normalizedUpdatePostRequest.posts)
            const editMediaTransform = this.getSingleEditTransform(normalizedUpdatePostRequest, selectedMediaIndices, file)

            if (normalizedUpdatePostRequest.postType === 'media') {
                let medias: Express.Multer.File[] | undefined

                if (file) {
                    medias = [file]
                } else {
                    const existingMedia = existingMediaAssets[0]
                    if (existingMedia) {
                        const mockFile = {
                            mimetype: existingMedia.type,
                            buffer: Buffer.alloc(0),
                            originalname: '',
                            size: 0,
                            fieldname: '',
                            encoding: '',
                            destination: '',
                            filename: '',
                            path: '',
                            stream: null as any,
                        } as Express.Multer.File
                        medias = [mockFile]
                    }
                }

                if (medias) {
                    const mediaCompatibilityError = this.validateMediaCompatibility(normalizedUpdatePostRequest, medias)
                    if (mediaCompatibilityError) {
                        throw new BaseAppError(mediaCompatibilityError.message, mediaCompatibilityError.code, 400)
                    }
                }
            }

            if (oldPost.status === PostStatus.DONE) {
                throw new BaseAppError(
                    'Post cannot be changed, it has been alreary got published!',
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            const scheduledUtc = this.resolveScheduledTime(
                normalizedUpdatePostRequest.scheduledAtLocal,
                normalizedUpdatePostRequest.timezone
            )
            const scheduledAtLocal = scheduledUtc ? (normalizedUpdatePostRequest.scheduledAtLocal ?? null) : null
            const scheduledTimezone = scheduledUtc ? (normalizedUpdatePostRequest.timezone ?? null) : null
            const shouldValidateScheduledTime =
                normalizedUpdatePostRequest.postStatus !== PostStatus.DRAFT && !normalizedUpdatePostRequest.postNow

            if (shouldValidateScheduledTime && scheduledUtc) {
                if (scheduledUtc.getTime() <= Date.now()) {
                    throw new BaseAppError(
                        'Scheduled time must be in the future',
                        ErrorCode.PAST_TIME_IS_NOT_ALLOWED,
                        400
                    )
                }
            }

            await this.postRepository.updateBasePost(
                postId,
                userId,
                normalizedUpdatePostRequest.postStatus as PostStatus,
                normalizedUpdatePostRequest.mainCaption ?? null,
                scheduledAtLocal,
                scheduledTimezone
            )

            if (normalizedUpdatePostRequest.postType === 'media') {
                if (file) {
                    const existingMedia = existingMediaAssets[0]
                    let processedBuffer = file.buffer
                    let contentType = file.mimetype
                    let fileName = file.originalname

                    if (editMediaTransform) {
                        const transformedImage = await this.transformImageWithFFmpeg(
                            processedBuffer,
                            contentType,
                            editMediaTransform
                        )
                        processedBuffer = transformedImage.buffer
                        contentType = transformedImage.contentType
                        fileName = this.updateFilenameExtension(fileName, contentType)
                    }

                    const mediaUrl = await this.mediaUploader.upload({
                        key: `${userId}/posts/${Date.now()}-${fileName}`,
                        body: processedBuffer,
                        contentType,
                    })

                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: mediaUrl,
                        type: contentType,
                    })

                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, 1)

                    if (existingMedia) {
                        await this.mediaUploader.delete(existingMedia.url)
                        if (existingMedia.mediaId) {
                            await this.postRepository.deletePostMediaAsset(existingMedia.mediaId)
                        }
                    }

                    this.logger.info('Successfully updated media', {
                        operation: 'editPost',
                        userId,
                        postId,
                        mediaId,
                    })
                }

            }

            const postTargets: PostTarget[] = normalizedUpdatePostRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }))

            await this.postRepository.updatePostTargets(postId, postTargets)

            const shouldSchedule =
                normalizedUpdatePostRequest.postStatus !== PostStatus.DRAFT &&
                !normalizedUpdatePostRequest.postNow &&
                !!scheduledUtc

            const oldPlatforms = oldPost.targets.map((target) => target.platform)

            if (shouldSchedule && scheduledUtc) {
                await this.cleanupScheduledJobs(postId, oldPlatforms, true)
                await this.schedulePostTargets(postId, userId, scheduledUtc, postTargets)
            } else {
                await this.cleanupScheduledJobs(postId, oldPlatforms, false)
            }

            this.logger.info(`Successfully updated ${updatePostRequest.postType} post`, {
                operation: 'editPost',
                userId,
                postId,
                postType: normalizedUpdatePostRequest.postType,
                targetCount: postTargets.length,
            })
        } catch (error: unknown) {
            if (error instanceof AppError) throw error
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to update post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async hasExistingMedia(postId: string): Promise<boolean> {
        try {
            const mediaAsset = await this.postRepository.getPostMediaAsset(postId)
            return !!mediaAsset
        } catch (error) {
            this.logger.error('Failed to check existing media', {
                operation: 'hasExistingMedia',
                postId,
            })
            return false
        }
    }

    async getPostsByFilters(userId: string, workspaceId: string, filters: PostFilters): Promise<PostsListResponse> {
        try {
            const response = await this.postRepository.getPosts(userId, workspaceId, filters)
            return response
        } catch (error) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get posts', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async deletePostsOrphanedByAccount(userId: string, accountId: string): Promise<void> {
        try {
            const orphanedPostIds = await this.postRepository.getPostsTargetedOnlyByAccount(userId, accountId)

            if (orphanedPostIds.length === 0) return

            const deletionResults = await Promise.allSettled(
                orphanedPostIds.map(async (postId) => {
                    await this.deletePost(postId, userId)
                    this.logger.info('Deleted post with no remaining targets after account removal', {
                        operation: 'deletePost',
                        userId,
                        postId,
                        removedAccountId: accountId,
                    })
                })
            )

            const failedDeletions = deletionResults.filter(
                (result): result is PromiseRejectedResult => result.status === 'rejected'
            )

            if (failedDeletions.length > 0) {
                this.logger.error('Failed to delete one or more orphaned posts for account removal', {
                    operation: 'deletePost',
                    userId,
                    removedAccountId: accountId,
                    failedCount: failedDeletions.length,
                })

                const firstError = failedDeletions[0].reason
                if (firstError instanceof BaseAppError) throw firstError
                throw new BaseAppError(
                    'Failed to delete orphaned post for account removal',
                    ErrorCode.UNKNOWN_ERROR,
                    500
                )
            }
        } catch (error) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError(
                'Failed to delete orphaned posts for account removal',
                ErrorCode.UNKNOWN_ERROR,
                500
            )
        }
    }

    async deletePost(postId: string, userId: string, workspaceId?: string): Promise<void> {
        try {
            const postDetails = await this.postRepository.getPostDetails(postId, userId)
            await this.cleanupScheduledJobs(
                postId,
                postDetails.targets.map((target) => target.platform),
                false
            )

            const { mediaUrls, coverImageUrl } = await this.postRepository.deletePost(postId, userId, workspaceId)

            if (mediaUrls.length > 0) {
                await Promise.all(
                    mediaUrls.map(async (url) => {
                        try {
                            await this.mediaUploader.delete(url)
                        } catch (error) {
                            this.logger.error('Failed to delete media from S3', {
                                operation: 'deletePost',
                                postId,
                                userId,
                                url,
                                error:
                                    error instanceof Error
                                        ? {
                                              name: error.name,
                                              stack: error.stack,
                                          }
                                        : undefined,
                            })
                        }
                    })
                )
            }

            if (coverImageUrl) {
                try {
                    await this.mediaUploader.delete(coverImageUrl)
                } catch (error) {
                    this.logger.error('Failed to delete cover image from S3', {
                        operation: 'deletePost',
                        postId,
                        userId,
                        coverImageUrl,
                        error:
                            error instanceof Error
                                ? {
                                      name: error.name,
                                      stack: error.stack,
                                  }
                                : undefined,
                    })
                }
            }

            this.logger.info('Successfully deleted post', {
                operation: 'deletePost',
                userId,
                postId,
                mediaCount: mediaUrls.length,
                hasCoverImage: !!coverImageUrl,
            })
        } catch (error) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to delete post', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsByDate(userId: string, workspaceId: string, fromDate: Date, toDate: Date): Promise<PostsByDateResponse> {
        try {
            const { posts } = await this.postRepository.getPostsByDate(userId, workspaceId, fromDate, toDate)

            return { posts }
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get posts by from date and to date', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async getPostsFailedCount(userId: string, workspaceId: string): Promise<number> {
        try {
            const failedCount = await this.postRepository.getPostsFailedCount(userId, workspaceId)

            return failedCount
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to get failed posts count', ErrorCode.BAD_REQUEST, 500)
        }
    }

    async retryPostTarget(
        userId: string,
        workspaceId: string,
        postId: string,
        socialAccountId: string
    ): Promise<{ postTarget: PostTargetResponse; post: CreatePostResponse }> {
        try {
            const result = await this.postRepository.retryPostTarget(userId, postId, socialAccountId)

            try {
                await this.socialMediaPostSender.sendPost(
                    userId,
                    postId,
                    result.postTarget.platform,
                    result.postTarget.socialAccountId
                )

                this.logger.info('Post target retry completed successfully', {
                    operation: 'retryPostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    platform: result.postTarget.platform,
                })

                return result
            } finally {
                this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this))
                this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this))
            }
        } catch (error: unknown) {
            this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this))
            this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this))

            try {
                await this.checkAndUpdateBasePostStatus(userId, postId)
            } catch (statusError) {
                this.logger.error('Failed to update post status after retry failure', {
                    operation: 'retryPostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    error:
                        statusError instanceof Error
                            ? {
                                  name: statusError.name,
                                  code: (statusError as any).code,
                                  stack: statusError.stack,
                              }
                            : undefined,
                })
            }

            const errorResult = await this.errorHandler.handleSocialMediaError(
                error,
                'unknown',
                userId,
                postId,
                socialAccountId
            )

            throw errorResult.error
        }
    }

    async cancelPostTarget(userId: string, postId: string, socialAccountId: string): Promise<void> {
        try {
            await this.postRepository.updatePostTarget(
                userId,
                postId,
                socialAccountId,
                PostStatus.FAILED,
                'Job cancelled'
            )

            this.logger.info('Cancelled post target', {
                operation: 'cancelPostTarget',
                userId,
                postId,
                socialAccountId,
            })
        } catch (error: unknown) {
            this.logger.error('Failed to cancel post target', {
                operation: 'cancelPostTarget',
                userId,
                postId,
                socialAccountId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })
            throw error
        }
    }

    async deletePostTarget(userId: string, workspaceId: string, postId: string, socialAccountId: string): Promise<void> {
        try {
            await this.postRepository.deletePostTarget(userId, postId, socialAccountId)

            try {
                await this.checkAndUpdateBasePostStatus(userId, postId)
            } catch (statusError) {
                this.logger.warn('Failed to update post status after deleting post target', {
                    operation: 'deletePostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    error:
                        statusError instanceof Error
                            ? {
                                  name: statusError.name,
                                  stack: statusError.stack,
                              }
                            : undefined,
                })
            }

            this.logger.info('Deleted post target successfully', {
                operation: 'deletePostTarget',
                userId,
                postId,
                socialAccountId,
            })
        } catch (error: unknown) {
            if (error instanceof BaseAppError) throw error

            this.logger.error('Failed to delete post target', {
                operation: 'deletePostTarget',
                userId,
                postId,
                socialAccountId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })

            throw new BaseAppError('Failed to delete post target', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async checkAndUpdateBasePostStatus(userId: string, postId: string): Promise<void> {
        try {
            const postDetails = await this.postRepository.getPostDetails(postId, userId)

            const allTargetsDone = postDetails.targets.every((target) => target.status === PostStatus.DONE)
            const someTargetsDone = postDetails.targets.some((target) => target.status === PostStatus.DONE)
            const someTargetsFailed = postDetails.targets.some((target) => target.status === PostStatus.FAILED)
            const allTargetsFailed = postDetails.targets.every((target) => target.status === PostStatus.FAILED)

            if (allTargetsDone && postDetails.status !== PostStatus.DONE) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.DONE, undefined)

                this.logger.info('Base post status updated to DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                })
            } else if (someTargetsDone && someTargetsFailed && postDetails.status !== PostStatus.PARTIALLY_DONE) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.PARTIALLY_DONE, undefined)

                this.logger.info('Base post status updated to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === PostStatus.FAILED).length,
                })
            } else if (postDetails.status === PostStatus.POSTING && someTargetsDone && someTargetsFailed) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.PARTIALLY_DONE, undefined)

                this.logger.info('Base post status updated from POSTING to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === PostStatus.FAILED).length,
                })
            } else if (allTargetsFailed && postDetails.status !== PostStatus.FAILED) {
                await this.postRepository.updateBasePost(postId, userId, PostStatus.FAILED, undefined)

                this.logger.info('Base post status updated to FAILED', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                })
            }
        } catch (error) {
            this.logger.error('Failed to check and update base post status', {
                operation: 'checkAndUpdateBasePostStatus',
                userId,
                postId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })
        }
    }

    async getFailedPostTargets(userId: string, workspaceId: string): Promise<PostTargetEntity[]> {
        try {
            const failedPosts = await this.postRepository.getFailedPostTargets(userId, workspaceId)

            return failedPosts
        } catch (err: unknown) {
            if (err instanceof BaseAppError) throw err
            throw new BaseAppError('Faile to get failed post targets', ErrorCode.BAD_REQUEST, 500)
        }
    }
}
