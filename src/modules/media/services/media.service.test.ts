import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { MediaService } from './media.service'
import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import { IMediaRepository } from '../repositories/media-repository.interface'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

describe('MediaService', () => {
    let mediaService: MediaService
    let mockLogger: jest.Mocked<ILogger>
    let mockMediaRepository: jest.Mocked<IMediaRepository>
    let mockMediaUploader: jest.Mocked<IMediaUploader>

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as jest.Mocked<ILogger>

        mockMediaRepository = {
            create: jest.fn(),
            findByKey: jest.fn(),
            findByUserId: jest.fn(),
            countByUserId: jest.fn(),
            deleteByKey: jest.fn(),
            deleteByUserId: jest.fn(),
        } as jest.Mocked<IMediaRepository>

        mockMediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
            listObjects: jest.fn(),
            getSignedUrl: jest.fn(),
        } as jest.Mocked<IMediaUploader>

        mediaService = new MediaService(mockLogger, mockMediaRepository, mockMediaUploader)
    })

    describe('listUserImages', () => {
        it('should list user images with pagination metadata', async () => {
            const userId = 'user-123'
            const mockDbItems = [
                {
                    id: '1',
                    userId: 'user-123',
                    key: 'user-123/covers/image1.jpg',
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/covers/image1.jpg',
                    size: 1024,
                    contentType: 'image/jpeg',
                    lastModified: new Date('2024-01-01'),
                    createdAt: new Date('2024-01-01'),
                    updatedAt: new Date('2024-01-01'),
                },
                {
                    id: '2',
                    userId: 'user-123',
                    key: 'user-123/accounts/image2.png',
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/accounts/image2.png',
                    size: 2048,
                    contentType: 'image/png',
                    lastModified: new Date('2024-01-02'),
                    createdAt: new Date('2024-01-02'),
                    updatedAt: new Date('2024-01-02'),
                },
            ]

            mockMediaRepository.countByUserId.mockResolvedValue(2)
            mockMediaRepository.findByUserId.mockResolvedValue(mockDbItems)

            const result = await mediaService.listUserImages(userId, {
                page: 1,
                limit: 50,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaRepository.countByUserId).toHaveBeenCalledWith(userId, undefined)
            expect(mockMediaRepository.findByUserId).toHaveBeenCalledWith(userId, {
                limit: 50,
                offset: 0,
                prefix: undefined,
            })

            expect(result.items).toHaveLength(2)
            expect(result.items[0].key).toBe('user-123/covers/image1.jpg')
            expect(result.items[0].url).toBe('https://test-bucket.s3.amazonaws.com/user-123/covers/image1.jpg')
            expect(result.items[0].signedUrl).toBeUndefined()
            expect(result.page).toBe(1)
            expect(result.pageSize).toBe(50)
            expect(result.totalItems).toBe(2)
            expect(result.totalPages).toBe(1)
            expect(result.hasNextPage).toBe(false)
            expect(result.hasPreviousPage).toBe(false)
        })

        it('should handle custom prefix', async () => {
            const userId = 'user-123'
            const customPrefix = 'covers/'
            const mockDbItems = [
                {
                    id: '1',
                    userId: 'user-123',
                    key: 'user-123/covers/image1.jpg',
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/covers/image1.jpg',
                    size: 1024,
                    contentType: 'image/jpeg',
                    lastModified: new Date('2024-01-01'),
                    createdAt: new Date('2024-01-01'),
                    updatedAt: new Date('2024-01-01'),
                },
            ]

            mockMediaRepository.countByUserId.mockResolvedValue(1)
            mockMediaRepository.findByUserId.mockResolvedValue(mockDbItems)

            await mediaService.listUserImages(userId, {
                page: 1,
                limit: 50,
                prefix: customPrefix,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaRepository.countByUserId).toHaveBeenCalledWith(userId, customPrefix)
            expect(mockMediaRepository.findByUserId).toHaveBeenCalledWith(userId, {
                limit: 50,
                offset: 0,
                prefix: customPrefix,
            })
        })

        it('should generate signed URLs when signed=true', async () => {
            const userId = 'user-123'
            const mockDbItems = [
                {
                    id: '1',
                    userId: 'user-123',
                    key: 'user-123/image.jpg',
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/image.jpg',
                    size: 1024,
                    contentType: 'image/jpeg',
                    lastModified: new Date('2024-01-01'),
                    createdAt: new Date('2024-01-01'),
                    updatedAt: new Date('2024-01-01'),
                },
            ]

            mockMediaRepository.countByUserId.mockResolvedValue(1)
            mockMediaRepository.findByUserId.mockResolvedValue(mockDbItems)
            mockMediaUploader.getSignedUrl.mockResolvedValue(
                'https://test-bucket.s3.amazonaws.com/user-123/image.jpg?signed=true'
            )

            const result = await mediaService.listUserImages(userId, {
                page: 1,
                limit: 50,
                signed: true,
                expiresIn: 7200,
            })

            expect(mockMediaUploader.getSignedUrl).toHaveBeenCalledWith('user-123/image.jpg', 7200)
            expect(result.items[0].signedUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/user-123/image.jpg?signed=true'
            )
        })

        it('should handle pagination with page 2', async () => {
            const userId = 'user-123'
            const mockDbItems = [
                {
                    id: '3',
                    userId: 'user-123',
                    key: 'user-123/image3.jpg',
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/image3.jpg',
                    size: 1024,
                    contentType: 'image/jpeg',
                    lastModified: new Date('2024-01-01'),
                    createdAt: new Date('2024-01-01'),
                    updatedAt: new Date('2024-01-01'),
                },
            ]

            mockMediaRepository.countByUserId.mockResolvedValue(30)
            mockMediaRepository.findByUserId.mockResolvedValue(mockDbItems)

            const result = await mediaService.listUserImages(userId, {
                page: 2,
                limit: 10,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaRepository.findByUserId).toHaveBeenCalledWith(userId, {
                limit: 10,
                offset: 10,
                prefix: undefined,
            })

            expect(result.page).toBe(2)
            expect(result.pageSize).toBe(10)
            expect(result.totalItems).toBe(30)
            expect(result.totalPages).toBe(3)
            expect(result.hasNextPage).toBe(true)
            expect(result.hasPreviousPage).toBe(true)
        })

        it('should respect limit constraint', async () => {
            const userId = 'user-123'

            mockMediaRepository.countByUserId.mockResolvedValue(0)
            mockMediaRepository.findByUserId.mockResolvedValue([])

            await mediaService.listUserImages(userId, {
                page: 1,
                limit: 25,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaRepository.findByUserId).toHaveBeenCalledWith(userId, {
                limit: 25,
                offset: 0,
                prefix: undefined,
            })
        })

        it('should throw BaseAppError on repository failure', async () => {
            const userId = 'user-123'

            mockMediaRepository.countByUserId.mockRejectedValue(new Error('Database connection failed'))

            await expect(
                mediaService.listUserImages(userId, {
                    page: 1,
                    limit: 50,
                    signed: false,
                    expiresIn: 3600,
                })
            ).rejects.toThrow(BaseAppError)

            await expect(
                mediaService.listUserImages(userId, {
                    page: 1,
                    limit: 50,
                    signed: false,
                    expiresIn: 3600,
                })
            ).rejects.toThrow('Failed to retrieve user images from storage')
        })

        it('should calculate total pages correctly', async () => {
            const userId = 'user-123'

            mockMediaRepository.countByUserId.mockResolvedValue(47)
            mockMediaRepository.findByUserId.mockResolvedValue([])

            const result = await mediaService.listUserImages(userId, {
                page: 1,
                limit: 10,
                signed: false,
                expiresIn: 3600,
            })

            expect(result.totalItems).toBe(47)
            expect(result.totalPages).toBe(5) // Math.ceil(47 / 10) = 5
        })

        it('should handle last page correctly', async () => {
            const userId = 'user-123'

            mockMediaRepository.countByUserId.mockResolvedValue(25)
            mockMediaRepository.findByUserId.mockResolvedValue([])

            const result = await mediaService.listUserImages(userId, {
                page: 3,
                limit: 10,
                signed: false,
                expiresIn: 3600,
            })

            expect(result.page).toBe(3)
            expect(result.totalPages).toBe(3)
            expect(result.hasNextPage).toBe(false)
            expect(result.hasPreviousPage).toBe(true)
        })
    })
})
