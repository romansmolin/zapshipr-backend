"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoConverter = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const promises_2 = require("stream/promises");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
class VideoConverter {
    constructor(logger) {
        this.TEMP_DIR = (0, path_1.join)(process.cwd(), 'temp', 'video-converter');
        // Platform-specific video requirements
        this.PLATFORM_REQUIREMENTS = {
            instagram: {
                reel: { aspectRatio: '9:16', maxDuration: 90, maxFileSize: 100 * 1024 * 1024 },
                post: { aspectRatio: '1:1', maxDuration: 60, maxFileSize: 100 * 1024 * 1024 },
                story: { aspectRatio: '9:16', maxDuration: 15, maxFileSize: 100 * 1024 * 1024 },
            },
            tiktok: {
                aspectRatio: '9:16',
                maxDuration: 180,
                maxFileSize: 500 * 1024 * 1024,
            },
            facebook: {
                aspectRatio: '16:9',
                maxDuration: 240,
                maxFileSize: 1000 * 1024 * 1024,
            },
            threads: {
                aspectRatio: '16:9',
                maxDuration: 30,
                maxFileSize: 100 * 1024 * 1024,
            },
        };
        this.logger = logger;
        this.ensureTempDir();
    }
    async ensureTempDir() {
        try {
            await (0, promises_1.mkdir)(this.TEMP_DIR, { recursive: true });
        }
        catch (error) {
            this.logger.error('Failed to create temp directory');
        }
    }
    async convertVideo(videoBuffer, options = { targetFormat: 'mp4', quality: 'medium' }) {
        const tempDir = (0, path_1.join)(this.TEMP_DIR, (0, crypto_1.randomUUID)());
        await (0, promises_1.mkdir)(tempDir, { recursive: true });
        const inputPath = (0, path_1.join)(tempDir, 'input.mov');
        const outputPath = (0, path_1.join)(tempDir, `output.${options.targetFormat}`);
        try {
            // Write input video to file
            await this.writeBufferToFile(videoBuffer, inputPath);
            // Convert video using FFmpeg
            await this.convertVideoFile(inputPath, outputPath, options);
            // Read converted video
            const convertedBuffer = await this.readFileToBuffer(outputPath);
            this.logger.info('Video conversion completed', {
                operation: 'convertVideo',
                originalSize: videoBuffer.length,
                convertedSize: convertedBuffer.length,
                targetFormat: options.targetFormat,
                quality: options.quality,
            });
            return convertedBuffer;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error('Video conversion failed', {
                operation: 'convertVideo',
                error: { name: 'VideoConversionError', stack: errorMessage },
            });
            throw new base_error_1.BaseAppError(`Video conversion failed: ${errorMessage}`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        finally {
            // Cleanup temp files
            try {
                await (0, promises_1.unlink)(inputPath);
                await (0, promises_1.unlink)(outputPath);
                await this.removeDirectory(tempDir);
            }
            catch (cleanupError) {
                const cleanupErrorMessage = cleanupError instanceof Error ? cleanupError.message : 'Unknown error';
                this.logger.warn('Failed to cleanup temp files', {
                    operation: 'convertVideo',
                    error: { name: 'CleanupError', stack: cleanupErrorMessage },
                });
            }
        }
    }
    async convertVideoFile(inputPath, outputPath, options) {
        return new Promise((resolve, reject) => {
            let command = (0, fluent_ffmpeg_1.default)(inputPath);
            // Set output format
            command = command.format(options.targetFormat);
            // Handle platform-specific processing
            if (options.platform) {
                const requirements = this.getPlatformRequirements(options.platform, options.videoType);
                const { width, height } = this.parseAspectToWH(requirements.aspectRatio, 1080);
                // Add padding to fit platform aspect ratio
                command = command
                    .complexFilter([
                    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p[outv]`,
                ])
                    .outputOptions(['-map [outv]', '-map 0:a?']);
            }
            // Set quality based on options
            switch (options.quality) {
                case 'high':
                    command = command.videoCodec('libx264').addOption('-crf', '18');
                    break;
                case 'medium':
                    command = command.videoCodec('libx264').addOption('-crf', '23');
                    break;
                case 'low':
                    command = command.videoCodec('libx264').addOption('-crf', '28');
                    break;
            }
            // Add audio codec
            command = command.audioCodec('aac');
            // Set file size limit if specified
            if (options.maxFileSize) {
                const maxSizeMB = Math.floor(options.maxFileSize / (1024 * 1024));
                command = command.addOption('-fs', `${maxSizeMB}M`);
            }
            // Add other optimization options
            command = command
                .addOption('-movflags', '+faststart') // Optimize for streaming
                .addOption('-preset', 'fast') // Faster encoding
                .addOption('-profile:v', 'high') // H.264 high profile
                .addOption('-level', '4.0'); // H.264 level 4.0
            command
                .on('start', (commandLine) => {
                this.logger.debug('FFmpeg conversion started', {
                    operation: 'convertVideoFile',
                    command: commandLine,
                });
            })
                .on('progress', (progress) => {
                this.logger.debug('FFmpeg conversion progress', {
                    operation: 'convertVideoFile',
                    percent: progress.percent,
                    timemark: progress.timemark,
                });
            })
                .on('end', () => {
                this.logger.info('FFmpeg conversion completed', {
                    operation: 'convertVideoFile',
                    inputPath,
                    outputPath,
                });
                resolve();
            })
                .on('error', (error) => {
                this.logger.error('FFmpeg conversion failed', {
                    operation: 'convertVideoFile',
                    error: { name: 'FFmpegError', stack: error.message },
                    inputPath,
                    outputPath,
                });
                reject(new Error(error.message));
            })
                .save(outputPath);
        });
    }
    async writeBufferToFile(buffer, filePath) {
        const stream = new stream_1.Readable();
        stream.push(buffer);
        stream.push(null);
        const writeStream = (0, fs_1.createWriteStream)(filePath);
        await (0, promises_2.pipeline)(stream, writeStream);
    }
    async readFileToBuffer(filePath) {
        const fs = require('fs');
        return fs.promises.readFile(filePath);
    }
    async removeDirectory(dirPath) {
        const fs = require('fs');
        await fs.promises.rmdir(dirPath, { recursive: true });
    }
    /**
     * Check if a video needs conversion based on its MIME type
     */
    needsConversion(mimeType, targetFormat = 'mp4') {
        if (targetFormat === 'mp4') {
            return mimeType !== 'video/mp4';
        }
        if (targetFormat === 'webm') {
            return mimeType !== 'video/webm';
        }
        return false;
    }
    /**
     * Get the appropriate MIME type for a target format
     */
    getMimeTypeForFormat(format) {
        switch (format) {
            case 'mp4':
                return 'video/mp4';
            case 'webm':
                return 'video/webm';
            default:
                return 'video/mp4';
        }
    }
    getPlatformRequirements(platform, videoType) {
        if (platform === 'instagram' && videoType) {
            return this.PLATFORM_REQUIREMENTS.instagram[videoType];
        }
        return this.PLATFORM_REQUIREMENTS[platform];
    }
    parseAspectToWH(aspectRatio, baseWidth) {
        const [w, h] = aspectRatio.split(':').map(Number);
        const height = Math.round((baseWidth * h) / w);
        return { width: baseWidth, height };
    }
}
exports.VideoConverter = VideoConverter;
