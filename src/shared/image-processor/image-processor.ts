import sharp from 'sharp'

import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'

import type { ILogger } from '../logger/logger.interface'

export interface ImageProcessingOptions {
    maxWidth?: number
    maxHeight?: number
    maxFileSize?: number // in bytes
    quality?: number
    format?: 'jpeg' | 'png' | 'webp'
    addPadding?: boolean
    backgroundColor?: string
}

export interface ImageTransform {
    /** 'original' or 'W:H' (e.g. '1:1', '4:5', '9:16') */
    ratio: string
    /** Frontend-reported source dimensions used to normalize the crop into pixel space */
    source: { width: number; height: number }
    crop: { x: number; y: number; scale: number }
}

export interface ImageTransformResult {
    buffer: Buffer
    contentType: string
}

export interface PlatformImageRequirements {
    facebook: ImageProcessingOptions
    tiktok: ImageProcessingOptions
    instagram: ImageProcessingOptions
    threads: ImageProcessingOptions
}

export class ImageProcessor {
    private logger: ILogger

    constructor(logger: ILogger) {
        this.logger = logger
    }

    private readonly platformRequirements: PlatformImageRequirements = {
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
    }

    async processImageForPlatform(
        imageBuffer: Buffer,
        platform: keyof PlatformImageRequirements,
        originalUrl?: string
    ): Promise<Buffer> {
        const requirements = this.platformRequirements[platform]

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
            })

            const metadata = await sharp(imageBuffer).metadata()
            const originalWidth = metadata.width || 0
            const originalHeight = metadata.height || 0

            this.logger.info('Original image metadata', {
                operation: 'processImageForPlatform',
                platform,
                originalWidth,
                originalHeight,
                originalFormat: metadata.format,
                originalSize: imageBuffer.length,
            })

            const { width, height } = this.calculateDimensions(
                originalWidth,
                originalHeight,
                requirements.maxWidth!,
                requirements.maxHeight!,
                requirements.addPadding!
            )

            this.logger.info('Calculated new dimensions', {
                operation: 'processImageForPlatform',
                platform,
                originalWidth,
                originalHeight,
                newWidth: width,
                newHeight: height,
                addPadding: requirements.addPadding,
            })

            let processedImage = sharp(imageBuffer)

            if (requirements.addPadding) {
                processedImage = processedImage.resize(width, height, {
                    fit: 'contain',
                    background: requirements.backgroundColor,
                })
            } else {
                processedImage = processedImage.resize(width, height, {
                    fit: 'cover',
                })
            }

            const outputFormat = requirements.format!
            if (outputFormat === 'jpeg') {
                processedImage = processedImage.jpeg({ quality: requirements.quality })
            } else if (outputFormat === 'png') {
                processedImage = processedImage.png({ quality: requirements.quality })
            } else if (outputFormat === 'webp') {
                processedImage = processedImage.webp({ quality: requirements.quality })
            }

            const processedBuffer = await processedImage.toBuffer()
            const finalSize = processedBuffer.length

            this.logger.info('Image processing completed', {
                operation: 'processImageForPlatform',
                platform,
                originalSize: imageBuffer.length,
                finalSize,
                sizeReduction: `${Math.round((1 - finalSize / imageBuffer.length) * 100)}%`,
                withinLimits: finalSize <= requirements.maxFileSize!,
            })

            if (finalSize > requirements.maxFileSize!) {
                this.logger.warn('Processed image still too large, applying additional compression', {
                    operation: 'processImageForPlatform',
                    platform,
                    finalSize,
                    maxAllowed: requirements.maxFileSize,
                    originalUrl,
                })

                return this.compressImage(processedBuffer, requirements.maxFileSize!)
            }

            return processedBuffer
        } catch (error) {
            this.logger.error('Image processing failed', {
                operation: 'processImageForPlatform',
                platform,
                originalUrl,
            })
            throw error
        }
    }

    private calculateDimensions(
        originalWidth: number,
        originalHeight: number,
        maxWidth: number,
        maxHeight: number,
        addPadding: boolean
    ): { width: number; height: number } {
        const aspectRatio = originalWidth / originalHeight
        const maxAspectRatio = maxWidth / maxHeight

        let width: number
        let height: number

        if (addPadding) {
            if (aspectRatio > maxAspectRatio) {
                width = maxWidth
                height = Math.round(maxWidth / aspectRatio)
            } else {
                height = maxHeight
                width = Math.round(maxHeight * aspectRatio)
            }
        } else {
            if (aspectRatio > maxAspectRatio) {
                height = maxHeight
                width = Math.round(maxHeight * aspectRatio)
            } else {
                width = maxWidth
                height = Math.round(maxWidth / aspectRatio)
            }
        }

        return { width, height }
    }

    private async compressImage(imageBuffer: Buffer, maxSize: number): Promise<Buffer> {
        let quality = 70
        let compressedBuffer = imageBuffer

        while (compressedBuffer.length > maxSize && quality > 10) {
            quality -= 10
            compressedBuffer = await sharp(imageBuffer).jpeg({ quality }).toBuffer()
        }

        if (compressedBuffer.length > maxSize) {
            this.logger.warn('Could not compress image to required size', {
                operation: 'compressImage',
                finalSize: compressedBuffer.length,
                maxSize,
                finalQuality: quality,
            })
        }

        return compressedBuffer
    }

    getPlatformRequirements(platform: keyof PlatformImageRequirements): ImageProcessingOptions {
        return this.platformRequirements[platform]
    }

    async validateImageForPlatform(
        imageBuffer: Buffer,
        platform: keyof PlatformImageRequirements
    ): Promise<{ valid: boolean; issues: string[] }> {
        const requirements = this.platformRequirements[platform]
        const issues: string[] = []

        try {
            const metadata = await sharp(imageBuffer).metadata()
            const fileSize = imageBuffer.length

            if (fileSize > requirements.maxFileSize!) {
                issues.push(
                    `File too large: ${Math.round(fileSize / 1024)}KB (max ${Math.round(requirements.maxFileSize! / 1024)}KB)`
                )
            }

            const width = metadata.width || 0
            const height = metadata.height || 0

            if (width > requirements.maxWidth!) {
                issues.push(`Width too large: ${width}px (max ${requirements.maxWidth}px)`)
            }

            if (height > requirements.maxHeight!) {
                issues.push(`Height too large: ${height}px (max ${requirements.maxHeight}px)`)
            }

            const format = metadata.format
            if (format && !this.isFormatSupported(format, requirements.format!)) {
                issues.push(`Unsupported format: ${format} (required: ${requirements.format})`)
            }

            return {
                valid: issues.length === 0,
                issues,
            }
        } catch (error) {
            issues.push(`Invalid image: ${error instanceof Error ? error.message : 'Unknown error'}`)
            return { valid: false, issues }
        }
    }

    private isFormatSupported(actualFormat: string, requiredFormat: string): boolean {
        const formatMap: Record<string, string[]> = {
            jpeg: ['jpeg', 'jpg'],
            png: ['png'],
            webp: ['webp'],
        }

        return formatMap[requiredFormat]?.includes(actualFormat.toLowerCase()) || false
    }

    async transformImage(
        imageBuffer: Buffer,
        mimeType: string,
        transform: ImageTransform
    ): Promise<ImageTransformResult> {
        const outputConfig = this.getTransformOutputConfig(mimeType)
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
                throw new BaseAppError(
                    'Failed to read image dimensions for mediaTransforms',
                    ErrorCode.BAD_REQUEST,
                    400
                )
            }

            const cropRect = this.computeCropRect(transform, actualWidth, actualHeight)
            const outputSize = this.resolveOutputSize(transform.ratio, cropRect)

            this.logger.debug('Resolved media transform', {
                operation: 'transformImage',
                ratio: transform.ratio,
                crop: transform.crop,
                source: transform.source,
                actualSource: { width: actualWidth, height: actualHeight },
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
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError(
                `Failed to apply media transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCode.BAD_REQUEST,
                400
            )
        }
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

    private resolveTransformRatio(
        transform: ImageTransform,
        sourceWidth: number,
        sourceHeight: number
    ): { width: number; height: number } {
        if (transform.ratio === 'original') {
            return { width: sourceWidth, height: sourceHeight }
        }
        return this.parseRatio(transform.ratio)
    }

    private resolveOutputSize(
        ratio: string,
        cropRect: { width: number; height: number }
    ): { width: number; height: number } {
        if (ratio === 'original') {
            const targetWidth = Math.min(1080, cropRect.width)
            return {
                width: targetWidth,
                height: Math.round((targetWidth * cropRect.height) / cropRect.width),
            }
        }

        if (ratio === '1:1') return { width: 1080, height: 1080 }
        if (ratio === '4:5') return { width: 1080, height: 1350 }
        if (ratio === '9:16') return { width: 1080, height: 1920 }

        const parsedRatio = this.parseRatio(ratio)
        return {
            width: 1080,
            height: Math.round((1080 * parsedRatio.height) / parsedRatio.width),
        }
    }

    private computeCropRect(
        transform: ImageTransform,
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

        return { width: cropWidth, height: cropHeight, left, top }
    }

    private getTransformOutputConfig(mimeType: string): { extension: string; mimeType: string } {
        if (mimeType === 'image/png') {
            return { extension: 'png', mimeType: 'image/png' }
        }
        return { extension: 'jpg', mimeType: 'image/jpeg' }
    }
}
