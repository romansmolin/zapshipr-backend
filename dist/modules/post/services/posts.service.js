"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostsService = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
const ffmpeg = __importStar(require("fluent-ffmpeg"));
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const video_converter_1 = require("@/shared/video-processor/video-converter");
const posts_types_1 = require("@/modules/post/types/posts.types");
class PostsService {
    constructor(postRepository, mediaUploader, logger, socialMediaPostSender, errorHandler, postScheduler) {
        this.postRepository = postRepository;
        this.logger = logger;
        this.mediaUploader = mediaUploader;
        this.socialMediaPostSender = socialMediaPostSender;
        this.videoConverter = new video_converter_1.VideoConverter(logger);
        this.errorHandler = errorHandler;
        this.postScheduler = postScheduler;
        this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this));
        this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this));
    }
    async uploadCoverImage(coverImageFile, userId) {
        const coverImageUrl = await this.mediaUploader.upload({
            key: `${userId}/covers/${Date.now()}-${coverImageFile.originalname}`,
            body: coverImageFile.buffer,
            contentType: coverImageFile.mimetype,
        });
        return coverImageUrl;
    }
    createServiceError(kind, code, message, status, details) {
        return {
            ok: false,
            kind,
            code,
            message,
            status,
            errorId: (0, crypto_1.randomUUID)(),
            details,
        };
    }
    validateMediaCompatibility(createPostsRequest, medias) {
        if (createPostsRequest.postType !== 'media') {
            return null;
        }
        if (!medias) {
            return null;
        }
        let mediaFiles = [];
        if (Array.isArray(medias)) {
            mediaFiles = medias;
        }
        else if (medias && typeof medias === 'object') {
            const filesWithoutCover = { ...medias };
            delete filesWithoutCover['coverImage'];
            mediaFiles = Object.values(filesWithoutCover).flat();
        }
        if (mediaFiles.length === 0) {
            return null;
        }
        const hasVideo = mediaFiles.some((file) => file.mimetype.startsWith('video/'));
        const hasImage = mediaFiles.some((file) => file.mimetype.startsWith('image/'));
        if (!hasVideo && !hasImage) {
            return null;
        }
        const incompatibleAccounts = [];
        for (const post of createPostsRequest.posts) {
            const platform = post.platform.toLowerCase();
            if (hasVideo && platform === 'bluesky') {
                incompatibleAccounts.push({
                    accountId: post.account,
                    platform: 'bluesky',
                    reason: 'Bluesky does not support video posts. Only images are supported.',
                });
            }
        }
        if (incompatibleAccounts.length > 0) {
            return this.createServiceError('MEDIA_COMPATIBILITY', error_codes_const_1.ErrorCode.CONTENT_VALIDATION_FAILED, 'Some selected accounts do not support the media type you are trying to publish.', 400, {
                incompatibleAccounts,
            });
        }
        return null;
    }
    async validateVideoDuration(file, createPostsRequest) {
        const hasInstagramTarget = createPostsRequest.posts.some((post) => post.platform === 'instagram');
        if (!hasInstagramTarget) {
            return;
        }
        try {
            const tempDir = await this.createTempDir();
            const tempFilePath = path.join(tempDir, `temp-${Date.now()}.${file.originalname.split('.').pop()}`);
            await this.writeBufferToFile(file.buffer, tempFilePath);
            const videoInfo = await this.getVideoDuration(tempFilePath);
            await this.cleanupTempFiles([tempFilePath], tempDir);
            if (videoInfo.duration < 3) {
                throw new base_error_1.BaseAppError(`Video duration is too short for Instagram Reels. Minimum duration is 3 seconds, but your video is ${videoInfo.duration.toFixed(2)} seconds.`, error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            this.logger.info('Video duration validation passed', {
                operation: 'validateVideoDuration',
                duration: videoInfo.duration,
                fileName: file.originalname,
                platform: 'instagram',
            });
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            this.logger.warn('Video duration validation failed, allowing upload', {
                operation: 'validateVideoDuration',
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
                fileName: file.originalname,
            });
        }
    }
    async getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                const duration = metadata.format.duration || 0;
                resolve({ duration });
            });
        });
    }
    async createTempDir() {
        const tempDir = path.join(process.cwd(), 'temp', 'video-validation', `validation-${Date.now()}`);
        await (0, promises_1.mkdir)(tempDir, { recursive: true });
        return tempDir;
    }
    async writeBufferToFile(buffer, filePath) {
        await (0, promises_1.writeFile)(filePath, buffer);
    }
    async cleanupTempFiles(filePaths, dir) {
        for (const filePath of filePaths) {
            try {
                await (0, promises_1.unlink)(filePath);
            }
            catch (error) {
                this.logger.warn('Failed to cleanup temporary file', {
                    filePath,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
            }
        }
        if (dir) {
            try {
                await (0, promises_1.rmdir)(dir);
            }
            catch (error) {
                this.logger.warn('Failed to cleanup temporary directory', {
                    dir,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
            }
        }
    }
    getFileMimeTypeFromURL(url, returnMimeType = false) {
        const pathname = new URL(url).pathname;
        const ext = pathname.split('.').pop()?.toLowerCase();
        if (!ext)
            return null;
        if (!returnMimeType) {
            return ext;
        }
        const mimeTypes = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
        };
        return mimeTypes[ext] || `application/octet-stream`;
    }
    buildSafeFilenameFromUrl(url, index) {
        try {
            const pathname = new URL(url).pathname;
            const decoded = decodeURIComponent(pathname.split('/').pop() || '');
            const base = decoded
                .replace(/[^a-zA-Z0-9._-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (base)
                return `${Date.now()}-${index}-${base}`;
        }
        catch (_) {
            // fallback handled below
        }
        return `${Date.now()}-${index}-media`;
    }
    buildSafeFilename(originalName, index, fallbackExt) {
        const name = decodeURIComponent(originalName || '').trim();
        const hasExt = name.includes('.');
        const safe = name
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const ext = hasExt ? '' : fallbackExt ? `.${fallbackExt}` : '';
        const base = safe || `media${ext}`;
        return `${Date.now()}-${index}-${base}`;
    }
    async uploadAndSaveMediaFiles(medias, userId, postId, createPostsRequest, copyDataUrls) {
        let mediaFiles = [];
        let orderCounter = 1;
        if (copyDataUrls && copyDataUrls.length > 0) {
            const copyTasks = copyDataUrls.map(async (copyUrl, idx) => {
                const safeName = this.buildSafeFilenameFromUrl(copyUrl, idx);
                try {
                    const response = await axios_1.default.get(copyUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data);
                    const mimeType = response.headers['content-type'] ||
                        this.getFileMimeTypeFromURL(copyUrl, true) ||
                        `application/octet-stream`;
                    const mediaUrl = await this.mediaUploader.upload({
                        key: `${userId}/posts/${safeName}`,
                        body: buffer,
                        contentType: mimeType,
                    });
                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: mediaUrl,
                        type: mimeType,
                    });
                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++);
                    this.logger.info('Attached copied media asset to post', {
                        operation: 'uploadAndSaveMediaFiles',
                        userId,
                        postId,
                        mediaId,
                        sourceIndex: idx,
                        mimeType,
                        order: orderCounter - 1,
                    });
                }
                catch (error) {
                    this.logger.warn('Failed to re-upload copied media, falling back to source URL', {
                        operation: 'uploadAndSaveMediaFiles',
                        userId,
                        postId,
                        copyUrl,
                        error: error instanceof Error
                            ? { name: error.name, code: 'COPY_UPLOAD_FAILED', stack: error.message }
                            : { name: 'UnknownError', code: 'COPY_UPLOAD_FAILED' },
                    });
                    const mimeType = this.getFileMimeTypeFromURL(copyUrl, true) || `application/octet-stream`;
                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: copyUrl,
                        type: mimeType,
                    });
                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++);
                }
            });
            await Promise.all(copyTasks);
        }
        if (Array.isArray(medias)) {
            mediaFiles = medias;
        }
        else if (medias && typeof medias === 'object') {
            delete medias['coverImage'];
            mediaFiles = Object.values(medias).flat();
        }
        if (mediaFiles.length > 0) {
            for (let index = 0; index < mediaFiles.length; index++) {
                const file = mediaFiles[index];
                let processedBuffer = file.buffer;
                let contentType = file.mimetype;
                let originalName = this.buildSafeFilename(file.originalname, orderCounter, file.mimetype.split('/')[1]);
                if (file.mimetype.includes('video')) {
                    await this.validateVideoDuration(file, createPostsRequest);
                }
                if (file.mimetype.includes('video') && this.videoConverter.needsConversion(file.mimetype, 'mp4')) {
                    this.logger.info('Converting video to MP4', {
                        operation: 'uploadAndSaveMediaFiles',
                        originalMimeType: file.mimetype,
                        originalName: file.originalname,
                    });
                    try {
                        processedBuffer = await this.videoConverter.convertVideo(file.buffer, {
                            targetFormat: 'mp4',
                            quality: 'medium',
                            maxFileSize: 50 * 1024 * 1024,
                        });
                        contentType = this.videoConverter.getMimeTypeForFormat('mp4');
                        originalName = originalName.replace(/\.(mov|MOV|webm|WEBM)$/, '.mp4');
                        this.logger.info('Video conversion completed', {
                            operation: 'uploadAndSaveMediaFiles',
                            originalSize: file.buffer.length,
                            convertedSize: processedBuffer.length,
                            newMimeType: contentType,
                            newName: originalName,
                        });
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        this.logger.error('Video conversion failed, using original file', {
                            operation: 'uploadAndSaveMediaFiles',
                            error: { name: 'VideoConversionError', stack: errorMessage },
                            originalMimeType: file.mimetype,
                        });
                        processedBuffer = file.buffer;
                        contentType = file.mimetype;
                    }
                }
                const mediaUrl = await this.mediaUploader.upload({
                    key: `${userId}/posts/${originalName}`,
                    body: processedBuffer,
                    contentType: contentType,
                });
                const { mediaId } = await this.postRepository.savePostMediaAssets({
                    userId,
                    url: mediaUrl,
                    type: contentType,
                });
                await this.postRepository.createPostMediaAssetRelation(postId, mediaId, orderCounter++);
                this.logger.info('Successfully uploaded media', {
                    operation: 'createPost',
                    userId,
                    postId,
                    mediaId,
                    index: orderCounter - 1,
                    totalFiles: mediaFiles.length + (copyDataUrls?.length ?? 0),
                    contentType,
                    originalName,
                });
            }
        }
    }
    requirePostScheduler() {
        if (!this.postScheduler) {
            throw new base_error_1.BaseAppError('Post scheduler is not configured', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        return this.postScheduler;
    }
    async schedulePostTargets(postId, userId, scheduledTime, targets) {
        if (targets.length === 0)
            return;
        const scheduler = this.requirePostScheduler();
        await Promise.all(targets.map((target) => scheduler.schedulePost(target.platform, postId, userId, scheduledTime, target.socialAccountId)));
    }
    async cleanupScheduledJobs(postId, platforms, throwOnError) {
        if (!this.postScheduler) {
            return;
        }
        const uniquePlatforms = Array.from(new Set(platforms));
        if (uniquePlatforms.length === 0)
            return;
        const results = await Promise.allSettled(uniquePlatforms.map((platform) => this.postScheduler.cleanupJobsForDeletedPost(platform, postId)));
        const failures = results.filter((result) => result.status === 'rejected');
        if (failures.length > 0) {
            this.logger.error('Failed to cleanup scheduled jobs', {
                operation: 'cleanupScheduledJobs',
                postId,
                platforms: uniquePlatforms,
                failureCount: failures.length,
            });
            if (throwOnError) {
                throw new base_error_1.BaseAppError('Failed to cleanup scheduled jobs', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
            }
        }
    }
    async createPost(createPostsRequest, medias, userId) {
        try {
            const mediaCompatibilityError = this.validateMediaCompatibility(createPostsRequest, medias);
            if (mediaCompatibilityError) {
                return mediaCompatibilityError;
            }
            const isDraft = createPostsRequest.postStatus === posts_types_1.PostStatus.DRAFT;
            const isScheduled = !isDraft && createPostsRequest.scheduledTime && !createPostsRequest.postNow;
            if (isScheduled && createPostsRequest.scheduledTime) {
                if (createPostsRequest.scheduledTime.getTime() <= Date.now()) {
                    throw new base_error_1.BaseAppError('Scheduled time must be in the future', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
            }
            let initialStatus = createPostsRequest.postStatus;
            if (isScheduled) {
                initialStatus = posts_types_1.PostStatus.PENDING;
            }
            let coverImageUrl;
            if (medias && typeof medias === 'object' && !Array.isArray(medias)) {
                const coverImageFiles = medias['coverImage'];
                if (Array.isArray(coverImageFiles) && coverImageFiles.length > 0) {
                    coverImageUrl = await this.uploadCoverImage(coverImageFiles[0], userId);
                }
            }
            const { postId } = await this.postRepository.createBasePost(userId, initialStatus, createPostsRequest.postType, createPostsRequest.scheduledTime ?? null, createPostsRequest.mainCaption ?? null, createPostsRequest.coverTimestamp ?? null, coverImageUrl);
            if (createPostsRequest.postType === 'media' && (medias || createPostsRequest.copyDataUrls)) {
                await this.uploadAndSaveMediaFiles(medias, userId, postId, createPostsRequest, createPostsRequest.copyDataUrls);
            }
            const postTargets = createPostsRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }));
            await this.postRepository.createPostTargets(postTargets);
            if (isScheduled && createPostsRequest.scheduledTime) {
                try {
                    await this.schedulePostTargets(postId, userId, createPostsRequest.scheduledTime, postTargets);
                }
                catch (error) {
                    await this.cleanupScheduledJobs(postId, postTargets.map((target) => target.platform), false);
                    await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.FAILED, createPostsRequest.scheduledTime, createPostsRequest.mainCaption ?? null);
                    this.logger.error('Failed to schedule post targets', {
                        operation: 'createPost',
                        postId,
                        userId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    if (error instanceof base_error_1.BaseAppError) {
                        throw error;
                    }
                    throw new base_error_1.BaseAppError('Failed to schedule post targets', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                }
            }
            if (!isDraft && createPostsRequest.postNow) {
                this.logger.info('Starting immediate post sending', {
                    operation: 'createPost',
                    userId,
                    postId,
                    postCount: createPostsRequest.posts.length,
                    platforms: createPostsRequest.posts.map((p) => p.platform),
                });
                const targetsByPlatform = createPostsRequest.posts.reduce((acc, target) => {
                    if (!acc[target.platform]) {
                        acc[target.platform] = [];
                    }
                    acc[target.platform].push(target);
                    return acc;
                }, {});
                const sendingPromises = Object.entries(targetsByPlatform).map(([platform, targets]) => {
                    return Promise.all(targets.map(async (target) => {
                        try {
                            await this.socialMediaPostSender.sendPost(userId, postId, platform, target.account);
                            return { success: true, target };
                        }
                        catch (error) {
                            return { success: false, target, error };
                        }
                    }));
                });
                const results = await Promise.allSettled(sendingPromises);
                const allTargetResults = [];
                results.forEach((platformResult, platformIndex) => {
                    if (platformResult.status === 'fulfilled') {
                        const targetResults = platformResult.value;
                        targetResults.forEach((targetResult) => {
                            allTargetResults.push({
                                target: targetResult.target,
                                success: targetResult.success,
                                error: targetResult.error,
                            });
                        });
                    }
                    else {
                        const platformTargets = Object.values(targetsByPlatform)[platformIndex];
                        platformTargets.forEach((target) => {
                            allTargetResults.push({
                                target,
                                success: false,
                                error: platformResult.reason,
                            });
                        });
                    }
                });
                const failures = allTargetResults.filter((item) => !item.success);
                const successes = allTargetResults.filter((item) => item.success);
                if (failures.length > 0) {
                    await Promise.all(failures.map(async ({ target, error }) => {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                        await this.postRepository.updatePostTarget(userId, postId, target.account, posts_types_1.PostStatus.FAILED, errorMessage);
                    }));
                }
                if (successes.length > 0) {
                    await Promise.all(successes.map(async ({ target }) => {
                        await this.postRepository.updatePostTarget(userId, postId, target.account, posts_types_1.PostStatus.DONE);
                    }));
                }
                if (failures.length === createPostsRequest.posts.length) {
                    await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.FAILED, createPostsRequest.scheduledTime || new Date(), createPostsRequest.mainCaption ?? null);
                    this.logger.error('All immediate posts failed to send', {
                        operation: 'createPost',
                        postId,
                        userId,
                        failureCount: failures.length,
                        totalPosts: createPostsRequest.posts.length,
                        errors: failures.map((f) => f.error instanceof Error ? f.error.message : 'Unknown error'),
                    });
                }
                else if (successes.length === createPostsRequest.posts.length) {
                    await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.DONE, createPostsRequest.scheduledTime || new Date(), createPostsRequest.mainCaption ?? null);
                    this.logger.info('All immediate posts sent successfully', {
                        operation: 'createPost',
                        postId,
                        userId,
                        successCount: successes.length,
                        totalPosts: createPostsRequest.posts.length,
                    });
                }
                else {
                    await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.PARTIALLY_DONE, createPostsRequest.scheduledTime || new Date(), createPostsRequest.mainCaption ?? null);
                    this.logger.warn('Some immediate posts failed to send', {
                        operation: 'createPost',
                        postId,
                        userId,
                        successCount: successes.length,
                        failureCount: failures.length,
                        totalPosts: createPostsRequest.posts.length,
                        errors: failures.map((f) => f.error instanceof Error ? f.error.message : 'Unknown error'),
                    });
                }
            }
            return await this.postRepository.getPostDetails(postId, userId);
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to create post', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async editPost(postId, updatePostRequest, file, userId) {
        try {
            const oldPost = await this.postRepository.getPostDetails(postId, userId);
            if (updatePostRequest.postType === 'media') {
                let medias;
                if (file) {
                    medias = [file];
                }
                else {
                    const existingMedia = await this.postRepository.getPostMediaAsset(postId);
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
                            stream: null,
                        };
                        medias = [mockFile];
                    }
                }
                if (medias) {
                    const mediaCompatibilityError = this.validateMediaCompatibility(updatePostRequest, medias);
                    if (mediaCompatibilityError) {
                        throw new base_error_1.BaseAppError(mediaCompatibilityError.message, mediaCompatibilityError.code, 400);
                    }
                }
            }
            if (oldPost.status === posts_types_1.PostStatus.DONE) {
                throw new base_error_1.BaseAppError('Post cannot be changed, it has been alreary got published!', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const shouldValidateScheduledTime = updatePostRequest.postStatus !== posts_types_1.PostStatus.DRAFT && !updatePostRequest.postNow;
            if (shouldValidateScheduledTime && updatePostRequest.scheduledTime) {
                if (updatePostRequest.scheduledTime.getTime() <= Date.now()) {
                    throw new base_error_1.BaseAppError('Scheduled time must be in the future', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
            }
            await this.postRepository.updateBasePost(postId, userId, updatePostRequest.postStatus, updatePostRequest.scheduledTime ?? null, updatePostRequest.mainCaption ?? null);
            if (updatePostRequest.postType === 'media') {
                if (file) {
                    const existingMedia = await this.postRepository.getPostMediaAsset(postId);
                    const mediaUrl = await this.mediaUploader.upload({
                        key: `${userId}/posts/${Date.now()}-${file.originalname}`,
                        body: file.buffer,
                        contentType: file.mimetype,
                    });
                    const { mediaId } = await this.postRepository.savePostMediaAssets({
                        userId,
                        url: mediaUrl,
                        type: file.mimetype,
                    });
                    await this.postRepository.createPostMediaAssetRelation(postId, mediaId, 1);
                    if (existingMedia) {
                        await this.mediaUploader.delete(existingMedia.url);
                        if (existingMedia.mediaId) {
                            await this.postRepository.deletePostMediaAsset(existingMedia.mediaId);
                        }
                    }
                    this.logger.info('Successfully updated media', {
                        operation: 'editPost',
                        userId,
                        postId,
                        mediaId,
                    });
                }
            }
            const postTargets = updatePostRequest.posts.map((post) => ({
                ...post,
                postId,
                socialAccountId: post.account,
            }));
            await this.postRepository.updatePostTargets(postId, postTargets);
            const shouldSchedule = updatePostRequest.postStatus !== posts_types_1.PostStatus.DRAFT &&
                !updatePostRequest.postNow &&
                !!updatePostRequest.scheduledTime;
            const oldPlatforms = oldPost.targets.map((target) => target.platform);
            if (shouldSchedule && updatePostRequest.scheduledTime) {
                await this.cleanupScheduledJobs(postId, oldPlatforms, true);
                await this.schedulePostTargets(postId, userId, updatePostRequest.scheduledTime, postTargets);
            }
            else {
                await this.cleanupScheduledJobs(postId, oldPlatforms, false);
            }
            this.logger.info(`Successfully updated ${updatePostRequest.postType} post`, {
                operation: 'editPost',
                userId,
                postId,
                postType: updatePostRequest.postType,
                targetCount: postTargets.length,
            });
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to update post', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async hasExistingMedia(postId) {
        try {
            const mediaAsset = await this.postRepository.getPostMediaAsset(postId);
            return !!mediaAsset;
        }
        catch (error) {
            this.logger.error('Failed to check existing media', {
                operation: 'hasExistingMedia',
                postId,
            });
            return false;
        }
    }
    async getPostsByFilters(userId, filters) {
        try {
            const response = await this.postRepository.getPosts(userId, filters);
            return response;
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to get posts', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async deletePostsOrphanedByAccount(userId, accountId) {
        try {
            const orphanedPostIds = await this.postRepository.getPostsTargetedOnlyByAccount(userId, accountId);
            if (orphanedPostIds.length === 0)
                return;
            const deletionResults = await Promise.allSettled(orphanedPostIds.map(async (postId) => {
                await this.deletePost(postId, userId);
                this.logger.info('Deleted post with no remaining targets after account removal', {
                    operation: 'deletePost',
                    userId,
                    postId,
                    removedAccountId: accountId,
                });
            }));
            const failedDeletions = deletionResults.filter((result) => result.status === 'rejected');
            if (failedDeletions.length > 0) {
                this.logger.error('Failed to delete one or more orphaned posts for account removal', {
                    operation: 'deletePost',
                    userId,
                    removedAccountId: accountId,
                    failedCount: failedDeletions.length,
                });
                const firstError = failedDeletions[0].reason;
                if (firstError instanceof base_error_1.BaseAppError)
                    throw firstError;
                throw new base_error_1.BaseAppError('Failed to delete orphaned post for account removal', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
            }
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to delete orphaned posts for account removal', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async deletePost(postId, userId) {
        try {
            const postDetails = await this.postRepository.getPostDetails(postId, userId);
            await this.cleanupScheduledJobs(postId, postDetails.targets.map((target) => target.platform), false);
            const { mediaUrls, coverImageUrl } = await this.postRepository.deletePost(postId, userId);
            if (mediaUrls.length > 0) {
                await Promise.all(mediaUrls.map(async (url) => {
                    try {
                        await this.mediaUploader.delete(url);
                    }
                    catch (error) {
                        this.logger.error('Failed to delete media from S3', {
                            operation: 'deletePost',
                            postId,
                            userId,
                            url,
                            error: error instanceof Error
                                ? {
                                    name: error.name,
                                    stack: error.stack,
                                }
                                : undefined,
                        });
                    }
                }));
            }
            if (coverImageUrl) {
                try {
                    await this.mediaUploader.delete(coverImageUrl);
                }
                catch (error) {
                    this.logger.error('Failed to delete cover image from S3', {
                        operation: 'deletePost',
                        postId,
                        userId,
                        coverImageUrl,
                        error: error instanceof Error
                            ? {
                                name: error.name,
                                stack: error.stack,
                            }
                            : undefined,
                    });
                }
            }
            this.logger.info('Successfully deleted post', {
                operation: 'deletePost',
                userId,
                postId,
                mediaCount: mediaUrls.length,
                hasCoverImage: !!coverImageUrl,
            });
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to delete post', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostsByDate(userId, fromDate, toDate) {
        try {
            const { posts } = await this.postRepository.getPostsByDate(userId, fromDate, toDate);
            return { posts };
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to get posts by from date and to date', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getPostsFailedCount(userId) {
        try {
            const failedCount = await this.postRepository.getPostsFailedCount(userId);
            return failedCount;
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to get failed posts count', error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async retryPostTarget(userId, postId, socialAccountId) {
        try {
            const result = await this.postRepository.retryPostTarget(userId, postId, socialAccountId);
            try {
                await this.socialMediaPostSender.sendPost(userId, postId, result.postTarget.platform, result.postTarget.socialAccountId);
                this.logger.info('Post target retry completed successfully', {
                    operation: 'retryPostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    platform: result.postTarget.platform,
                });
                return result;
            }
            finally {
                this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this));
                this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this));
            }
        }
        catch (error) {
            this.socialMediaPostSender.setOnPostSuccessCallback(this.checkAndUpdateBasePostStatus.bind(this));
            this.socialMediaPostSender.setOnPostFailureCallback(this.checkAndUpdateBasePostStatus.bind(this));
            try {
                await this.checkAndUpdateBasePostStatus(userId, postId);
            }
            catch (statusError) {
                this.logger.error('Failed to update post status after retry failure', {
                    operation: 'retryPostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    error: statusError instanceof Error
                        ? {
                            name: statusError.name,
                            code: statusError.code,
                            stack: statusError.stack,
                        }
                        : undefined,
                });
            }
            const errorResult = await this.errorHandler.handleSocialMediaError(error, 'unknown', userId, postId, socialAccountId);
            throw errorResult.error;
        }
    }
    async cancelPostTarget(userId, postId, socialAccountId) {
        try {
            await this.postRepository.updatePostTarget(userId, postId, socialAccountId, posts_types_1.PostStatus.FAILED, 'Job cancelled');
            this.logger.info('Cancelled post target', {
                operation: 'cancelPostTarget',
                userId,
                postId,
                socialAccountId,
            });
        }
        catch (error) {
            this.logger.error('Failed to cancel post target', {
                operation: 'cancelPostTarget',
                userId,
                postId,
                socialAccountId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw error;
        }
    }
    async deletePostTarget(userId, postId, socialAccountId) {
        try {
            await this.postRepository.deletePostTarget(userId, postId, socialAccountId);
            try {
                await this.checkAndUpdateBasePostStatus(userId, postId);
            }
            catch (statusError) {
                this.logger.warn('Failed to update post status after deleting post target', {
                    operation: 'deletePostTarget',
                    userId,
                    postId,
                    socialAccountId,
                    error: statusError instanceof Error
                        ? {
                            name: statusError.name,
                            stack: statusError.stack,
                        }
                        : undefined,
                });
            }
            this.logger.info('Deleted post target successfully', {
                operation: 'deletePostTarget',
                userId,
                postId,
                socialAccountId,
            });
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            this.logger.error('Failed to delete post target', {
                operation: 'deletePostTarget',
                userId,
                postId,
                socialAccountId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw new base_error_1.BaseAppError('Failed to delete post target', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async checkAndUpdateBasePostStatus(userId, postId) {
        try {
            const postDetails = await this.postRepository.getPostDetails(postId, userId);
            const allTargetsDone = postDetails.targets.every((target) => target.status === posts_types_1.PostStatus.DONE);
            const someTargetsDone = postDetails.targets.some((target) => target.status === posts_types_1.PostStatus.DONE);
            const someTargetsFailed = postDetails.targets.some((target) => target.status === posts_types_1.PostStatus.FAILED);
            const allTargetsFailed = postDetails.targets.every((target) => target.status === posts_types_1.PostStatus.FAILED);
            if (allTargetsDone && postDetails.status !== posts_types_1.PostStatus.DONE) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.DONE, new Date(), undefined);
                this.logger.info('Base post status updated to DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                });
            }
            else if (someTargetsDone && someTargetsFailed && postDetails.status !== posts_types_1.PostStatus.PARTIALLY_DONE) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.PARTIALLY_DONE, new Date(), undefined);
                this.logger.info('Base post status updated to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === posts_types_1.PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === posts_types_1.PostStatus.FAILED).length,
                });
            }
            else if (postDetails.status === posts_types_1.PostStatus.POSTING && someTargetsDone && someTargetsFailed) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.PARTIALLY_DONE, new Date(), undefined);
                this.logger.info('Base post status updated from POSTING to PARTIALLY_DONE', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                    doneCount: postDetails.targets.filter((t) => t.status === posts_types_1.PostStatus.DONE).length,
                    failedCount: postDetails.targets.filter((t) => t.status === posts_types_1.PostStatus.FAILED).length,
                });
            }
            else if (allTargetsFailed && postDetails.status !== posts_types_1.PostStatus.FAILED) {
                await this.postRepository.updateBasePost(postId, userId, posts_types_1.PostStatus.FAILED, new Date(), undefined);
                this.logger.info('Base post status updated to FAILED', {
                    operation: 'checkAndUpdateBasePostStatus',
                    userId,
                    postId,
                    targetCount: postDetails.targets.length,
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to check and update base post status', {
                operation: 'checkAndUpdateBasePostStatus',
                userId,
                postId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
        }
    }
    async getFailedPostTargets(userId) {
        try {
            const failedPosts = await this.postRepository.getFailedPostTargets(userId);
            return failedPosts;
        }
        catch (err) {
            if (err instanceof base_error_1.BaseAppError)
                throw err;
            throw new base_error_1.BaseAppError('Faile to get failed post targets', error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
}
exports.PostsService = PostsService;
