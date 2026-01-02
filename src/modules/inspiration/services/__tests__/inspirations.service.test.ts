import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { InspirationsService } from '../inspirations.service'
import type { IInspirationsRepository } from '../../repositories/inspirations-repository.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import type { IInspirationScheduler } from '@/shared/queue/scheduler/inspiration-scheduler/inspiration-scheduler.interface'
import type { ILogger } from '@/shared/logger/logger.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { RawInspiration } from '../../entity/raw-inspiration.schema'

describe('InspirationsService', () => {
    let service: InspirationsService
    let mockRepository: jest.Mocked<IInspirationsRepository>
    let mockMediaUploader: jest.Mocked<IMediaUploader>
    let mockScheduler: jest.Mocked<IInspirationScheduler>
    let mockLogger: jest.Mocked<ILogger>

    beforeEach(() => {
        // Mock repository
        mockRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByWorkspaceId: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            checkDuplicateUrl: jest.fn(),
        } as any

        // Mock media uploader
        mockMediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
        } as any

        // Mock scheduler
        mockScheduler = {
            scheduleInspiration: jest.fn(),
        } as any

        // Mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as any

        service = new InspirationsService(mockRepository, mockMediaUploader, mockScheduler, mockLogger)
    })

    describe('createInspiration', () => {
        it('should create text inspiration successfully', async () => {
            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'This is a test inspiration',
                imageUrl: null,
                userDescription: 'Test description',
                metadata: null,
                parsedContent: null,
                status: 'processing',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockRepository.create.mockResolvedValue(mockInspiration)

            const result = await service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'This is a test inspiration',
                userDescription: 'Test description',
            })

            expect(result).toEqual(mockInspiration)
            expect(mockRepository.create).toHaveBeenCalledWith({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'This is a test inspiration',
                imageUrl: undefined,
                userDescription: 'Test description',
                status: 'processing',
            })
            expect(mockScheduler.scheduleInspiration).toHaveBeenCalledWith('123', 'ws-1', 'user-1')
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Created inspiration',
                expect.objectContaining({
                    inspirationId: '123',
                    workspaceId: 'ws-1',
                })
            )
        })

        it('should throw error for duplicate URL', async () => {
            mockRepository.checkDuplicateUrl.mockResolvedValue(true)

            await expect(
                service.createInspiration({
                    workspaceId: 'ws-1',
                    userId: 'user-1',
                    type: 'link',
                    content: 'https://example.com',
                })
            ).rejects.toThrow(AppError)

            await expect(
                service.createInspiration({
                    workspaceId: 'ws-1',
                    userId: 'user-1',
                    type: 'link',
                    content: 'https://example.com',
                })
            ).rejects.toMatchObject({
                errorMessageCode: ErrorMessageCode.DUPLICATE_INSPIRATION,
                httpCode: 409,
            })
        })

        it('should upload image to S3 and create inspiration', async () => {
            const mockFile = {
                buffer: Buffer.from('test'),
                originalname: 'test.jpg',
                mimetype: 'image/jpeg',
            } as Express.Multer.File

            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'image',
                content: null,
                imageUrl: 'https://s3.amazonaws.com/test.jpg',
                userDescription: null,
                metadata: null,
                parsedContent: null,
                status: 'processing',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockMediaUploader.upload.mockResolvedValue('https://s3.amazonaws.com/test.jpg')
            mockRepository.create.mockResolvedValue(mockInspiration)

            const result = await service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'image',
                file: mockFile,
            })

            expect(mockMediaUploader.upload).toHaveBeenCalledWith({
                key: expect.stringContaining('ws-1/images/'),
                body: mockFile.buffer,
                contentType: 'image/jpeg',
            })
            expect(result.imageUrl).toBe('https://s3.amazonaws.com/test.jpg')
        })

        it('should not check for duplicates for non-link types', async () => {
            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'Test content',
                imageUrl: null,
                userDescription: null,
                metadata: null,
                parsedContent: null,
                status: 'processing',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockRepository.create.mockResolvedValue(mockInspiration)

            await service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'Test content',
            })

            expect(mockRepository.checkDuplicateUrl).not.toHaveBeenCalled()
        })
    })

    describe('getInspirations', () => {
        it('should return inspirations list with pagination', async () => {
            const mockInspirations: RawInspiration[] = [
                {
                    id: '1',
                    workspaceId: 'ws-1',
                    userId: 'user-1',
                    type: 'text',
                    content: 'Test 1',
                    imageUrl: null,
                    userDescription: null,
                    metadata: null,
                    parsedContent: null,
                    status: 'completed',
                    errorMessage: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: '2',
                    workspaceId: 'ws-1',
                    userId: 'user-1',
                    type: 'link',
                    content: 'https://example.com',
                    imageUrl: null,
                    userDescription: null,
                    metadata: null,
                    parsedContent: null,
                    status: 'completed',
                    errorMessage: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ]

            mockRepository.findByWorkspaceId.mockResolvedValue({
                items: mockInspirations,
                total: 2,
            })

            const result = await service.getInspirations('ws-1', { limit: 20, offset: 0 })

            expect(result).toEqual({
                items: mockInspirations,
                total: 2,
                limit: 20,
                offset: 0,
            })
            expect(mockRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1', { limit: 20, offset: 0 })
        })

        it('should use default pagination values', async () => {
            mockRepository.findByWorkspaceId.mockResolvedValue({
                items: [],
                total: 0,
            })

            const result = await service.getInspirations('ws-1')

            expect(result.limit).toBe(20)
            expect(result.offset).toBe(0)
        })
    })

    describe('getInspirationById', () => {
        it('should return inspiration by id', async () => {
            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'Test',
                imageUrl: null,
                userDescription: null,
                metadata: null,
                parsedContent: null,
                status: 'completed',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockRepository.findById.mockResolvedValue(mockInspiration)

            const result = await service.getInspirationById('123')

            expect(result).toEqual(mockInspiration)
            expect(mockRepository.findById).toHaveBeenCalledWith('123')
        })

        it('should return null if inspiration not found', async () => {
            mockRepository.findById.mockResolvedValue(undefined)

            const result = await service.getInspirationById('nonexistent')

            expect(result).toBeNull()
        })
    })

    describe('updateInspiration', () => {
        it('should update inspiration successfully', async () => {
            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'Test',
                imageUrl: null,
                userDescription: 'Old description',
                metadata: null,
                parsedContent: null,
                status: 'completed',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const updatedInspiration = {
                ...mockInspiration,
                userDescription: 'New description',
            }

            mockRepository.findById.mockResolvedValue(mockInspiration)
            mockRepository.update.mockResolvedValue(updatedInspiration)

            const result = await service.updateInspiration('123', 'New description')

            expect(result).toEqual(updatedInspiration)
            expect(mockRepository.update).toHaveBeenCalledWith('123', { userDescription: 'New description' })
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Updated inspiration',
                expect.objectContaining({
                    inspirationId: '123',
                })
            )
        })

        it('should throw error if inspiration not found', async () => {
            mockRepository.findById.mockResolvedValue(undefined)

            await expect(service.updateInspiration('nonexistent', 'New description')).rejects.toThrow(AppError)

            await expect(service.updateInspiration('nonexistent', 'New description')).rejects.toMatchObject({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                httpCode: 404,
            })
        })
    })

    describe('deleteInspiration', () => {
        it('should delete inspiration successfully', async () => {
            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'Test',
                imageUrl: null,
                userDescription: null,
                metadata: null,
                parsedContent: null,
                status: 'completed',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockRepository.findById.mockResolvedValue(mockInspiration)
            mockRepository.delete.mockResolvedValue(true)

            const result = await service.deleteInspiration('123')

            expect(result).toBe(true)
            expect(mockRepository.delete).toHaveBeenCalledWith('123')
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Deleted inspiration',
                expect.objectContaining({
                    inspirationId: '123',
                })
            )
        })

        it('should delete S3 file if exists', async () => {
            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'image',
                content: null,
                imageUrl: 'https://s3.amazonaws.com/test.jpg',
                userDescription: null,
                metadata: null,
                parsedContent: null,
                status: 'completed',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockRepository.findById.mockResolvedValue(mockInspiration)
            mockRepository.delete.mockResolvedValue(true)
            mockMediaUploader.delete.mockResolvedValue(undefined)

            await service.deleteInspiration('123')

            expect(mockMediaUploader.delete).toHaveBeenCalledWith('https://s3.amazonaws.com/test.jpg')
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Deleted inspiration file from S3',
                expect.objectContaining({
                    imageUrl: 'https://s3.amazonaws.com/test.jpg',
                })
            )
        })

        it('should continue with DB deletion if S3 deletion fails', async () => {
            const mockInspiration: RawInspiration = {
                id: '123',
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'image',
                content: null,
                imageUrl: 'https://s3.amazonaws.com/test.jpg',
                userDescription: null,
                metadata: null,
                parsedContent: null,
                status: 'completed',
                errorMessage: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockRepository.findById.mockResolvedValue(mockInspiration)
            mockRepository.delete.mockResolvedValue(true)
            mockMediaUploader.delete.mockRejectedValue(new Error('S3 error'))

            const result = await service.deleteInspiration('123')

            expect(result).toBe(true)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to delete file from S3, continuing with DB deletion',
                expect.any(Object)
            )
            expect(mockRepository.delete).toHaveBeenCalled()
        })

        it('should throw error if inspiration not found', async () => {
            mockRepository.findById.mockResolvedValue(undefined)

            await expect(service.deleteInspiration('nonexistent')).rejects.toThrow(AppError)

            await expect(service.deleteInspiration('nonexistent')).rejects.toMatchObject({
                errorMessageCode: ErrorMessageCode.INSPIRATION_NOT_FOUND,
                httpCode: 404,
            })
        })
    })
})
