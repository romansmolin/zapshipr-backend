"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessor = void 0;
const sharp_1 = __importDefault(require("sharp"));
class ImageProcessor {
    constructor(logger) {
        this.platformRequirements = {
            facebook: {
                maxWidth: 1200,
                maxHeight: 1200,
                maxFileSize: 5 * 1024 * 1024,
                quality: 85,
                format: 'jpeg',
                addPadding: true,
                backgroundColor: '#FFFFFF',
            },
            tiktok: {
                maxWidth: 1080,
                maxHeight: 1920,
                maxFileSize: 1024 * 1024,
                quality: 90,
                format: 'jpeg',
                addPadding: true,
                backgroundColor: '#000000',
            },
            instagram: {
                maxWidth: 1080,
                maxHeight: 1080,
                maxFileSize: 8 * 1024 * 1024,
                quality: 85,
                format: 'jpeg',
                addPadding: true,
                backgroundColor: '#FFFFFF',
            },
            threads: {
                maxWidth: 1200,
                maxHeight: 1200,
                maxFileSize: 5 * 1024 * 1024,
                quality: 85,
                format: 'jpeg',
                addPadding: true,
                backgroundColor: '#FFFFFF',
            },
        };
        this.logger = logger;
    }
    async processImageForPlatform(imageBuffer, platform, originalUrl) {
        const requirements = this.platformRequirements[platform];
        try {
            this.logger.info('Processing image for platform', {
                operation: 'processImageForPlatform',
                platform,
                originalSize: imageBuffer.length,
                requirements: {
                    maxWidth: requirements.maxWidth,
                    maxHeight: requirements.maxHeight,
                    maxFileSize: requirements.maxFileSize,
                    format: requirements.format,
                },
            });
            const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
            const originalWidth = metadata.width || 0;
            const originalHeight = metadata.height || 0;
            this.logger.info('Original image metadata', {
                operation: 'processImageForPlatform',
                platform,
                originalWidth,
                originalHeight,
                originalFormat: metadata.format,
                originalSize: imageBuffer.length,
            });
            const { width, height } = this.calculateDimensions(originalWidth, originalHeight, requirements.maxWidth, requirements.maxHeight, requirements.addPadding);
            this.logger.info('Calculated new dimensions', {
                operation: 'processImageForPlatform',
                platform,
                originalWidth,
                originalHeight,
                newWidth: width,
                newHeight: height,
                addPadding: requirements.addPadding,
            });
            let processedImage = (0, sharp_1.default)(imageBuffer);
            if (requirements.addPadding) {
                processedImage = processedImage.resize(width, height, {
                    fit: 'contain',
                    background: requirements.backgroundColor,
                });
            }
            else {
                processedImage = processedImage.resize(width, height, {
                    fit: 'cover',
                });
            }
            const outputFormat = requirements.format;
            if (outputFormat === 'jpeg') {
                processedImage = processedImage.jpeg({ quality: requirements.quality });
            }
            else if (outputFormat === 'png') {
                processedImage = processedImage.png({ quality: requirements.quality });
            }
            else if (outputFormat === 'webp') {
                processedImage = processedImage.webp({ quality: requirements.quality });
            }
            const processedBuffer = await processedImage.toBuffer();
            const finalSize = processedBuffer.length;
            this.logger.info('Image processing completed', {
                operation: 'processImageForPlatform',
                platform,
                originalSize: imageBuffer.length,
                finalSize,
                sizeReduction: `${Math.round((1 - finalSize / imageBuffer.length) * 100)}%`,
                withinLimits: finalSize <= requirements.maxFileSize,
            });
            if (finalSize > requirements.maxFileSize) {
                this.logger.warn('Processed image still too large, applying additional compression', {
                    operation: 'processImageForPlatform',
                    platform,
                    finalSize,
                    maxAllowed: requirements.maxFileSize,
                    originalUrl,
                });
                return this.compressImage(processedBuffer, requirements.maxFileSize);
            }
            return processedBuffer;
        }
        catch (error) {
            this.logger.error('Image processing failed', {
                operation: 'processImageForPlatform',
                platform,
                originalUrl,
            });
            throw error;
        }
    }
    calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight, addPadding) {
        const aspectRatio = originalWidth / originalHeight;
        const maxAspectRatio = maxWidth / maxHeight;
        let width;
        let height;
        if (addPadding) {
            if (aspectRatio > maxAspectRatio) {
                width = maxWidth;
                height = Math.round(maxWidth / aspectRatio);
            }
            else {
                height = maxHeight;
                width = Math.round(maxHeight * aspectRatio);
            }
        }
        else {
            if (aspectRatio > maxAspectRatio) {
                height = maxHeight;
                width = Math.round(maxHeight * aspectRatio);
            }
            else {
                width = maxWidth;
                height = Math.round(maxWidth / aspectRatio);
            }
        }
        return { width, height };
    }
    async compressImage(imageBuffer, maxSize) {
        let quality = 70;
        let compressedBuffer = imageBuffer;
        while (compressedBuffer.length > maxSize && quality > 10) {
            quality -= 10;
            compressedBuffer = await (0, sharp_1.default)(imageBuffer).jpeg({ quality }).toBuffer();
        }
        if (compressedBuffer.length > maxSize) {
            this.logger.warn('Could not compress image to required size', {
                operation: 'compressImage',
                finalSize: compressedBuffer.length,
                maxSize,
                finalQuality: quality,
            });
        }
        return compressedBuffer;
    }
    getPlatformRequirements(platform) {
        return this.platformRequirements[platform];
    }
    async validateImageForPlatform(imageBuffer, platform) {
        const requirements = this.platformRequirements[platform];
        const issues = [];
        try {
            const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
            const fileSize = imageBuffer.length;
            if (fileSize > requirements.maxFileSize) {
                issues.push(`File too large: ${Math.round(fileSize / 1024)}KB (max ${Math.round(requirements.maxFileSize / 1024)}KB)`);
            }
            const width = metadata.width || 0;
            const height = metadata.height || 0;
            if (width > requirements.maxWidth) {
                issues.push(`Width too large: ${width}px (max ${requirements.maxWidth}px)`);
            }
            if (height > requirements.maxHeight) {
                issues.push(`Height too large: ${height}px (max ${requirements.maxHeight}px)`);
            }
            const format = metadata.format;
            if (format && !this.isFormatSupported(format, requirements.format)) {
                issues.push(`Unsupported format: ${format} (required: ${requirements.format})`);
            }
            return {
                valid: issues.length === 0,
                issues,
            };
        }
        catch (error) {
            issues.push(`Invalid image: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { valid: false, issues };
        }
    }
    isFormatSupported(actualFormat, requiredFormat) {
        const formatMap = {
            jpeg: ['jpeg', 'jpg'],
            png: ['png'],
            webp: ['webp'],
        };
        return formatMap[requiredFormat]?.includes(actualFormat.toLowerCase()) || false;
    }
}
exports.ImageProcessor = ImageProcessor;
