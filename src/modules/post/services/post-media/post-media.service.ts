import { randomUUID } from 'crypto'

import axios from 'axios'

import { ErrorCode } from '@/shared/consts/error-codes.const'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { BaseAppError } from '@/shared/errors/base-error'
import { VideoConverter } from '@/shared/video-processor/video-converter'
import {
    getFileExtensionFromMimeType,
    getFileMimeTypeFromURL,
} from '@/shared/utils/mime'
import {
    buildSafeFilename,
    buildSafeFilenameFromUrl,
    updateFilenameExtension,
} from '@/shared/utils/filename'
import { buildS3UrlFromKey } from '@/shared/utils/s3'

import type { IPostMediaService } from './post-media-service.interface'
import type {
    MediaCompatibilityError,
    ServiceErrorEnvelope,
    PostPreparationJobPayload,
} from '../posts/posts-service.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type {
    CreatePostsRequest,
    MediaTransformRequest,
    UploadedMediaRequest,
} from '@/modules/post/schemas/posts.schemas'
import type { IMediaUploader } from '@/shared/media-uploader'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IVideoProcessor } from '@/shared/video-processor/video-processor.interface'
import type { ImageProcessor } from '@/shared/image-processor/image-processor'

type MediaInput = Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined

export class PostMediaService implements IPostMediaService {
    constructor(
        private readonly postRepository: IPostsRepository,
        private readonly mediaUploader: IMediaUploader,
        private readonly imageProcessor: ImageProcessor,
        private readonly videoConverter: VideoConverter,
        private readonly videoProcessor: IVideoProcessor,
        private readonly logger: ILogger
    ) {}

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

    extractUploadedMediaFiles(medias: MediaInput): Express.Multer.File[] {
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

    getMediaTransforms(createPostsRequest: CreatePostsRequest): MediaTransformRequest[] {
        return createPostsRequest.mediaTransforms ?? []
    }

    private buildAllMediaIndices(mediaCount: number): number[] {
        if (mediaCount <= 0) {
            return []
        }

        return Array.from({ length: mediaCount }, (_, index) => index)
    }

    collectSelectedMediaIndices(posts: CreatePostsRequest['posts']): Set<number> {
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

    normalizePostTargetsMediaIndices(
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

    getSingleEditTransform(
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
            throw new BaseAppError(
                'mediaTransforms can only be applied to image files',
                ErrorCode.BAD_REQUEST,
                400
            )
        }

        if (!selectedMediaIndices.has(0)) {
            return null
        }

        return transformMap.get(0) ?? null
    }

    validateMediaCompatibility(
        createPostsRequest: CreatePostsRequest,
        medias: MediaInput
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
                const mimeType = getFileMimeTypeFromURL(url, true)
                return Boolean(mimeType?.startsWith('video/'))
            })
        const hasImage =
            mediaFiles.some((file) => file.mimetype.startsWith('image/')) ||
            uploadedMedia.some((media) => media.type.startsWith('image/')) ||
            copyDataUrls.some((url) => {
                const mimeType = getFileMimeTypeFromURL(url, true)
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
                { incompatibleAccounts }
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
            const extension = file.originalname.split('.').pop()
            const duration = await this.videoProcessor.getDurationFromBuffer(file.buffer, extension)

            if (duration < 3) {
                throw new BaseAppError(
                    `Video duration is too short for Instagram Reels. Minimum duration is 3 seconds, but your video is ${duration.toFixed(2)} seconds.`,
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            this.logger.info('Video duration validation passed', {
                operation: 'validateVideoDuration',
                duration,
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

    async uploadAndSaveMediaFiles(
        medias: MediaInput,
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
                const safeName = buildSafeFilenameFromUrl(copyUrl, idx)
                try {
                    const response = await axios.get<ArrayBuffer>(copyUrl, { responseType: 'arraybuffer' })
                    const buffer = Buffer.from(response.data)
                    const mimeType =
                        response.headers['content-type'] ||
                        getFileMimeTypeFromURL(copyUrl, true) ||
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
                        sizeBytes: buffer.length,
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

                    const mimeType = getFileMimeTypeFromURL(copyUrl, true) || `application/octet-stream`
                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: copyUrl,
                        type: mimeType,
                        sizeBytes: 0,
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
                let originalName = buildSafeFilename(
                    file.originalname,
                    orderCounter,
                    file.mimetype.split('/')[1]
                )
                const shouldApplyTransform =
                    !selectedMediaIndices || selectedMediaIndices.has(copyMediaCount + index)
                const mediaTransform = shouldApplyTransform ? mediaTransformMap.get(index) : undefined

                if (mediaTransform) {
                    const transformedImage = await this.imageProcessor.transformImage(
                        processedBuffer,
                        contentType,
                        mediaTransform
                    )
                    processedBuffer = transformedImage.buffer
                    contentType = transformedImage.contentType
                    originalName = updateFilenameExtension(originalName, contentType)
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
                    sizeBytes: processedBuffer.length,
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

    async saveUploadedMediaReferences(
        uploadedMedia: UploadedMediaRequest[],
        userId: string,
        postId: string,
        orderCounter: number
    ): Promise<number> {
        for (const media of uploadedMedia) {
            const mediaUrl = media.url ?? buildS3UrlFromKey(media.key)
            const { mediaId } = await this.postRepository.savePostMediaAssets({
                userId,
                url: mediaUrl,
                type: media.type,
                sizeBytes: media.size ?? 0,
            })

            await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)
        }

        return orderCounter
    }

    async saveCopyMediaReferences(
        copyDataUrls: string[] | null | undefined,
        userId: string,
        postId: string,
        orderCounter: number
    ): Promise<number> {
        if (!copyDataUrls?.length) {
            return orderCounter
        }

        for (const copyUrl of copyDataUrls) {
            const mimeType = getFileMimeTypeFromURL(copyUrl, true) || 'application/octet-stream'
            const { mediaId } = await this.postRepository.savePostMediaAssets({
                userId,
                url: copyUrl,
                type: mimeType,
                sizeBytes: 0,
            })
            await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)
        }

        return orderCounter
    }

    private async saveMultipartMediaWithoutTransforms(
        medias: MediaInput,
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
            const fallbackExtension = getFileExtensionFromMimeType(file.mimetype) ?? 'bin'
            const fileName = buildSafeFilename(file.originalname, orderCounter + index, fallbackExtension)
            const mediaUrl = await this.mediaUploader.upload({
                key: `${userId}/posts/${fileName}`,
                body: file.buffer,
                contentType: file.mimetype,
            })

            const { mediaId } = await this.postRepository.savePostMediaAssets({
                userId,
                url: mediaUrl,
                type: file.mimetype,
                sizeBytes: file.buffer.length,
            })

            await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++)
        }

        return orderCounter
    }

    async attachMediaReferencesForAsyncPostNow(
        medias: MediaInput,
        request: CreatePostsRequest,
        userId: string,
        postId: string
    ): Promise<void> {
        let orderCounter = 1
        orderCounter = await this.saveCopyMediaReferences(request.copyDataUrls, userId, postId, orderCounter)
        orderCounter = await this.saveUploadedMediaReferences(
            request.uploadedMedia ?? [],
            userId,
            postId,
            orderCounter
        )
        await this.saveMultipartMediaWithoutTransforms(medias, userId, postId, orderCounter)
    }

    async applyMediaTransformsToStoredAssets(payload: PostPreparationJobPayload): Promise<void> {
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
            const transformedImage = await this.imageProcessor.transformImage(sourceBuffer, mediaAsset.type, transform)
            const extension = getFileExtensionFromMimeType(transformedImage.contentType) ?? 'jpg'
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
}
