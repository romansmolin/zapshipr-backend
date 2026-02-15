import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import { ILogger } from '@/shared/logger/logger.interface'
import { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import { IMediaRepository } from '../repositories/media-repository.interface'
import { MediaService } from './media.service'

describe('MediaService', () => {
    let mediaService: MediaService
    let mockLogger: jest.Mocked<ILogger>
    let mockMediaRepository: jest.Mocked<IMediaRepository>
    let mockMediaUploader: jest.Mocked<IMediaUploader>

    beforeEach(() => {
        process.env.AWS_S3_BUCKET = 'test-bucket'

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
            findPostMediaByUserId: jest.fn(),
            deleteByKey: jest.fn(),
            deleteByUserId: jest.fn(),
        } as jest.Mocked<IMediaRepository>

        mockMediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
            listObjects: jest.fn(),
            getSignedUrl: jest.fn(),
            getPresignedUploadUrl: jest.fn(),
        } as jest.Mocked<IMediaUploader>

        mediaService = new MediaService(mockLogger, mockMediaRepository, mockMediaUploader)
    })

    describe('listUserImages', () => {
        it('returns only post-scoped media from post relations', async () => {
            const userId = 'user-123'
            mockMediaRepository.findPostMediaByUserId.mockResolvedValue([
                {
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/posts/image-1.jpg',
                    contentType: 'image/jpeg',
                    lastModified: new Date('2026-02-15T10:00:00.000Z'),
                },
                {
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/covers/cover-1.jpg',
                    contentType: 'image/jpeg',
                    lastModified: new Date('2026-02-15T09:00:00.000Z'),
                },
            ])

            const result = await mediaService.listUserImages(userId, {
                page: 1,
                limit: 20,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaRepository.findPostMediaByUserId).toHaveBeenCalledWith(userId)
            expect(mockMediaRepository.countByUserId).not.toHaveBeenCalled()
            expect(mockMediaRepository.findByUserId).not.toHaveBeenCalled()
            expect(result.items).toHaveLength(1)
            expect(result.items[0].key).toBe('user-123/posts/image-1.jpg')
            expect(result.totalItems).toBe(1)
            expect(result.totalPages).toBe(1)
        })

        it('applies custom prefix inside posts scope', async () => {
            const userId = 'user-123'
            mockMediaRepository.findPostMediaByUserId.mockResolvedValue([
                {
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/posts/transformed/image-1.jpg',
                    contentType: 'image/jpeg',
                    lastModified: new Date('2026-02-15T10:00:00.000Z'),
                },
                {
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/posts/original/image-2.jpg',
                    contentType: 'image/jpeg',
                    lastModified: new Date('2026-02-15T09:00:00.000Z'),
                },
            ])

            const result = await mediaService.listUserImages(userId, {
                page: 1,
                limit: 20,
                prefix: 'transformed/',
                signed: false,
                expiresIn: 3600,
            })

            expect(result.items).toHaveLength(1)
            expect(result.items[0].key).toBe('user-123/posts/transformed/image-1.jpg')
        })

        it('generates signed urls for s3 objects', async () => {
            const userId = 'user-123'
            mockMediaRepository.findPostMediaByUserId.mockResolvedValue([
                {
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/posts/image-1.jpg',
                    contentType: 'image/jpeg',
                    lastModified: new Date('2026-02-15T10:00:00.000Z'),
                },
            ])
            mockMediaUploader.getSignedUrl.mockResolvedValue(
                'https://test-bucket.s3.amazonaws.com/user-123/posts/image-1.jpg?signed=1'
            )

            const result = await mediaService.listUserImages(userId, {
                page: 1,
                limit: 20,
                signed: true,
                expiresIn: 7200,
            })

            expect(mockMediaUploader.getSignedUrl).toHaveBeenCalledWith('user-123/posts/image-1.jpg', 7200)
            expect(result.items[0].signedUrl).toContain('signed=1')
        })

        it('falls back to legacy user_media when no post-linked records found', async () => {
            const userId = 'user-123'
            mockMediaRepository.findPostMediaByUserId.mockResolvedValue([])
            mockMediaRepository.countByUserId.mockResolvedValue(2)
            mockMediaRepository.findByUserId.mockResolvedValue([
                {
                    id: 'legacy-1',
                    userId,
                    key: 'user-123/posts/image-legacy-1.jpg',
                    url: 'https://test-bucket.s3.amazonaws.com/user-123/posts/image-legacy-1.jpg',
                    size: 100,
                    contentType: 'image/jpeg',
                    lastModified: new Date('2026-02-15T08:00:00.000Z'),
                    createdAt: new Date('2026-02-15T08:00:00.000Z'),
                    updatedAt: new Date('2026-02-15T08:00:00.000Z'),
                },
            ])

            const result = await mediaService.listUserImages(userId, {
                page: 1,
                limit: 10,
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaRepository.countByUserId).toHaveBeenCalledWith(userId, 'posts/')
            expect(mockMediaRepository.findByUserId).toHaveBeenCalledWith(userId, {
                limit: 10,
                offset: 0,
                prefix: 'posts/',
            })
            expect(result.totalItems).toBe(2)
            expect(result.items).toHaveLength(1)
            expect(result.items[0].key).toBe('user-123/posts/image-legacy-1.jpg')
        })

        it('normalizes prefix to posts scope in legacy fallback', async () => {
            const userId = 'user-123'
            mockMediaRepository.findPostMediaByUserId.mockResolvedValue([])
            mockMediaRepository.countByUserId.mockResolvedValue(0)
            mockMediaRepository.findByUserId.mockResolvedValue([])

            await mediaService.listUserImages(userId, {
                page: 1,
                limit: 10,
                prefix: 'covers/',
                signed: false,
                expiresIn: 3600,
            })

            expect(mockMediaRepository.countByUserId).toHaveBeenCalledWith(userId, 'posts/covers/')
            expect(mockMediaRepository.findByUserId).toHaveBeenCalledWith(userId, {
                limit: 10,
                offset: 0,
                prefix: 'posts/covers/',
            })
        })

        it('paginates post-linked media in memory', async () => {
            const userId = 'user-123'
            mockMediaRepository.findPostMediaByUserId.mockResolvedValue(
                Array.from({ length: 25 }, (_, index) => ({
                    url: `https://test-bucket.s3.amazonaws.com/user-123/posts/image-${index}.jpg`,
                    contentType: 'image/jpeg',
                    lastModified: new Date(`2026-02-15T${String(index % 24).padStart(2, '0')}:00:00.000Z`),
                }))
            )

            const result = await mediaService.listUserImages(userId, {
                page: 3,
                limit: 10,
                signed: false,
                expiresIn: 3600,
            })

            expect(result.page).toBe(3)
            expect(result.totalItems).toBe(25)
            expect(result.totalPages).toBe(3)
            expect(result.items).toHaveLength(5)
            expect(result.hasNextPage).toBe(false)
            expect(result.hasPreviousPage).toBe(true)
        })

        it('throws BaseAppError when repository fails', async () => {
            const userId = 'user-123'
            mockMediaRepository.findPostMediaByUserId.mockRejectedValue(new Error('db down'))

            await expect(
                mediaService.listUserImages(userId, {
                    page: 1,
                    limit: 10,
                    signed: false,
                    expiresIn: 3600,
                })
            ).rejects.toEqual(
                new BaseAppError(
                    'Failed to retrieve user images from storage',
                    ErrorCode.UNKNOWN_ERROR,
                    500
                )
            )
        })
    })
})
