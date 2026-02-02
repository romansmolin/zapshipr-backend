import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { MediaService } from './media.service'
import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaUploader, ListObjectsResult } from '@/shared/media-uploader/media-uploader.interface'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

describe('MediaService', () => {
    let mediaService: MediaService
    let mockLogger: jest.Mocked<ILogger>
    let mockMediaUploader: jest.Mocked<IMediaUploader>

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as jest.Mocked<ILogger>

        mockMediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
            listObjects: jest.fn(),
            getSignedUrl: jest.fn(),
        } as jest.Mocked<IMediaUploader>

        mediaService = new MediaService(mockLogger, mockMediaUploader)

        // Set environment variable for tests
        process.env.AWS_S3_BUCKET = 'test-bucket'
    })

    describe('listUserImages', () => {
        it('should list user images with default prefix', async () => {
            const userId = 'user-123'
            const mockS3Response: ListObjectsResult = {
                items: [
                    {
                        key: 'user-123/covers/image1.jpg',
                        size: 1024,
                        lastModified: new Date('2024-01-01'),
                    },
                    {
                        key: 'user-123/accounts/image2.png',
                        size: 2048,
                        lastModified: new Date('2024-01-02'),
                    },
                ],
                isTruncated: false,
            }

            mockMediaUploader.listObjects.mockResolvedValue(mockS3Response)

            const result = await mediaService.listUserImages(userId, {
                limit: 50,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaUploader.listObjects).toHaveBeenCalledWith({
                prefix: 'user-123/',
                maxKeys: 50,
                continuationToken: undefined,
            })

            expect(result.items).toHaveLength(2)
            expect(result.items[0].key).toBe('user-123/covers/image1.jpg')
            expect(result.items[0].url).toBe(
                'https://test-bucket.s3.amazonaws.com/user-123/covers/image1.jpg'
            )
            expect(result.items[0].signedUrl).toBeUndefined()
            expect(result.hasMore).toBe(false)
        })

        it('should filter out non-image files', async () => {
            const userId = 'user-123'
            const mockS3Response: ListObjectsResult = {
                items: [
                    {
                        key: 'user-123/image.jpg',
                        size: 1024,
                        lastModified: new Date('2024-01-01'),
                    },
                    {
                        key: 'user-123/document.pdf',
                        size: 2048,
                        lastModified: new Date('2024-01-02'),
                    },
                    {
                        key: 'user-123/video.mp4',
                        size: 4096,
                        lastModified: new Date('2024-01-03'),
                    },
                ],
                isTruncated: false,
            }

            mockMediaUploader.listObjects.mockResolvedValue(mockS3Response)

            const result = await mediaService.listUserImages(userId, {
                limit: 50,
                signed: false,
                expiresIn: 3600,
            })

            expect(result.items).toHaveLength(1)
            expect(result.items[0].key).toBe('user-123/image.jpg')
        })

        it('should handle custom prefix', async () => {
            const userId = 'user-123'
            const customPrefix = 'covers/'
            const mockS3Response: ListObjectsResult = {
                items: [
                    {
                        key: 'user-123/covers/image1.jpg',
                        size: 1024,
                        lastModified: new Date('2024-01-01'),
                    },
                ],
                isTruncated: false,
            }

            mockMediaUploader.listObjects.mockResolvedValue(mockS3Response)

            await mediaService.listUserImages(userId, {
                limit: 50,
                prefix: customPrefix,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaUploader.listObjects).toHaveBeenCalledWith({
                prefix: 'user-123/covers/',
                maxKeys: 50,
                continuationToken: undefined,
            })
        })

        it('should generate signed URLs when signed=true', async () => {
            const userId = 'user-123'
            const mockS3Response: ListObjectsResult = {
                items: [
                    {
                        key: 'user-123/image.jpg',
                        size: 1024,
                        lastModified: new Date('2024-01-01'),
                    },
                ],
                isTruncated: false,
            }

            mockMediaUploader.listObjects.mockResolvedValue(mockS3Response)
            mockMediaUploader.getSignedUrl.mockResolvedValue(
                'https://test-bucket.s3.amazonaws.com/user-123/image.jpg?signed=true'
            )

            const result = await mediaService.listUserImages(userId, {
                limit: 50,
                signed: true,
                expiresIn: 7200,
            })

            expect(mockMediaUploader.getSignedUrl).toHaveBeenCalledWith('user-123/image.jpg', 7200)
            expect(result.items[0].signedUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/user-123/image.jpg?signed=true'
            )
        })

        it('should handle pagination with cursor', async () => {
            const userId = 'user-123'
            const cursor = 'next-page-token'
            const mockS3Response: ListObjectsResult = {
                items: [
                    {
                        key: 'user-123/image.jpg',
                        size: 1024,
                        lastModified: new Date('2024-01-01'),
                    },
                ],
                nextContinuationToken: 'another-page-token',
                isTruncated: true,
            }

            mockMediaUploader.listObjects.mockResolvedValue(mockS3Response)

            const result = await mediaService.listUserImages(userId, {
                limit: 10,
                cursor,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaUploader.listObjects).toHaveBeenCalledWith({
                prefix: 'user-123/',
                maxKeys: 10,
                continuationToken: cursor,
            })

            expect(result.nextCursor).toBe('another-page-token')
            expect(result.hasMore).toBe(true)
        })

        it('should respect limit constraint', async () => {
            const userId = 'user-123'
            const mockS3Response: ListObjectsResult = {
                items: [],
                isTruncated: false,
            }

            mockMediaUploader.listObjects.mockResolvedValue(mockS3Response)

            await mediaService.listUserImages(userId, {
                limit: 25,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaUploader.listObjects).toHaveBeenCalledWith({
                prefix: 'user-123/',
                maxKeys: 25,
                continuationToken: undefined,
            })
        })

        it('should throw BaseAppError on S3 failure', async () => {
            const userId = 'user-123'

            mockMediaUploader.listObjects.mockRejectedValue(new Error('S3 connection failed'))

            await expect(
                mediaService.listUserImages(userId, {
                    limit: 50,
                    signed: false,
                    expiresIn: 3600,
                })
            ).rejects.toThrow(BaseAppError)

            await expect(
                mediaService.listUserImages(userId, {
                    limit: 50,
                    signed: false,
                    expiresIn: 3600,
                })
            ).rejects.toThrow('Failed to retrieve user images from storage')
        })

        it('should handle all common image extensions', async () => {
            const userId = 'user-123'
            const mockS3Response: ListObjectsResult = {
                items: [
                    { key: 'user-123/test.jpg', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.jpeg', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.png', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.gif', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.webp', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.svg', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.bmp', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.ico', size: 100, lastModified: new Date() },
                    { key: 'user-123/test.txt', size: 100, lastModified: new Date() },
                ],
                isTruncated: false,
            }

            mockMediaUploader.listObjects.mockResolvedValue(mockS3Response)

            const result = await mediaService.listUserImages(userId, {
                limit: 50,
                signed: false,
                expiresIn: 3600,
            })

            // Should include 8 image files, exclude .txt
            expect(result.items).toHaveLength(8)
        })
    })
})
