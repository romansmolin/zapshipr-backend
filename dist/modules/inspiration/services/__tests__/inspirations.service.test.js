"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const inspirations_service_1 = require("../inspirations.service");
const app_error_1 = require("@/shared/errors/app-error");
(0, globals_1.describe)('InspirationsService', () => {
    let service;
    let mockRepository;
    let mockMediaUploader;
    let mockScheduler;
    let mockLogger;
    (0, globals_1.beforeEach)(() => {
        // Mock repository
        mockRepository = {
            create: globals_1.jest.fn(),
            findById: globals_1.jest.fn(),
            findByWorkspaceId: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
            checkDuplicateUrl: globals_1.jest.fn(),
        };
        // Mock media uploader
        mockMediaUploader = {
            upload: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        };
        // Mock scheduler
        mockScheduler = {
            scheduleInspiration: globals_1.jest.fn(),
        };
        // Mock logger
        mockLogger = {
            info: globals_1.jest.fn(),
            error: globals_1.jest.fn(),
            warn: globals_1.jest.fn(),
            debug: globals_1.jest.fn(),
        };
        service = new inspirations_service_1.InspirationsService(mockRepository, mockMediaUploader, mockScheduler, mockLogger);
    });
    (0, globals_1.describe)('createInspiration', () => {
        (0, globals_1.it)('should create text inspiration successfully', async () => {
            const mockInspiration = {
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
            };
            mockRepository.create.mockResolvedValue(mockInspiration);
            const result = await service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'This is a test inspiration',
                userDescription: 'Test description',
            });
            (0, globals_1.expect)(result).toEqual(mockInspiration);
            (0, globals_1.expect)(mockRepository.create).toHaveBeenCalledWith({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'This is a test inspiration',
                imageUrl: undefined,
                userDescription: 'Test description',
                status: 'processing',
            });
            (0, globals_1.expect)(mockScheduler.scheduleInspiration).toHaveBeenCalledWith('123', 'ws-1', 'user-1');
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith('Created inspiration', globals_1.expect.objectContaining({
                inspirationId: '123',
                workspaceId: 'ws-1',
            }));
        });
        (0, globals_1.it)('should throw error for duplicate URL', async () => {
            mockRepository.checkDuplicateUrl.mockResolvedValue(true);
            await (0, globals_1.expect)(service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'link',
                content: 'https://example.com',
            })).rejects.toThrow(app_error_1.AppError);
            await (0, globals_1.expect)(service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'link',
                content: 'https://example.com',
            })).rejects.toMatchObject({
                errorMessageCode: app_error_1.ErrorMessageCode.DUPLICATE_INSPIRATION,
                httpCode: 409,
            });
        });
        (0, globals_1.it)('should upload image to S3 and create inspiration', async () => {
            const mockFile = {
                buffer: Buffer.from('test'),
                originalname: 'test.jpg',
                mimetype: 'image/jpeg',
            };
            const mockInspiration = {
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
            };
            mockMediaUploader.upload.mockResolvedValue('https://s3.amazonaws.com/test.jpg');
            mockRepository.create.mockResolvedValue(mockInspiration);
            const result = await service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'image',
                file: mockFile,
            });
            (0, globals_1.expect)(mockMediaUploader.upload).toHaveBeenCalledWith({
                key: globals_1.expect.stringContaining('ws-1/images/'),
                body: mockFile.buffer,
                contentType: 'image/jpeg',
            });
            (0, globals_1.expect)(result.imageUrl).toBe('https://s3.amazonaws.com/test.jpg');
        });
        (0, globals_1.it)('should not check for duplicates for non-link types', async () => {
            const mockInspiration = {
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
            };
            mockRepository.create.mockResolvedValue(mockInspiration);
            await service.createInspiration({
                workspaceId: 'ws-1',
                userId: 'user-1',
                type: 'text',
                content: 'Test content',
            });
            (0, globals_1.expect)(mockRepository.checkDuplicateUrl).not.toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('getInspirations', () => {
        (0, globals_1.it)('should return inspirations list with pagination', async () => {
            const mockInspirations = [
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
            ];
            mockRepository.findByWorkspaceId.mockResolvedValue({
                items: mockInspirations,
                total: 2,
            });
            const result = await service.getInspirations('ws-1', { limit: 20, offset: 0 });
            (0, globals_1.expect)(result).toEqual({
                items: mockInspirations,
                total: 2,
                limit: 20,
                offset: 0,
            });
            (0, globals_1.expect)(mockRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1', { limit: 20, offset: 0 });
        });
        (0, globals_1.it)('should use default pagination values', async () => {
            mockRepository.findByWorkspaceId.mockResolvedValue({
                items: [],
                total: 0,
            });
            const result = await service.getInspirations('ws-1');
            (0, globals_1.expect)(result.limit).toBe(20);
            (0, globals_1.expect)(result.offset).toBe(0);
        });
    });
    (0, globals_1.describe)('getInspirationById', () => {
        (0, globals_1.it)('should return inspiration by id', async () => {
            const mockInspiration = {
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
            };
            mockRepository.findById.mockResolvedValue(mockInspiration);
            const result = await service.getInspirationById('123');
            (0, globals_1.expect)(result).toEqual(mockInspiration);
            (0, globals_1.expect)(mockRepository.findById).toHaveBeenCalledWith('123');
        });
        (0, globals_1.it)('should return null if inspiration not found', async () => {
            mockRepository.findById.mockResolvedValue(undefined);
            const result = await service.getInspirationById('nonexistent');
            (0, globals_1.expect)(result).toBeNull();
        });
    });
    (0, globals_1.describe)('updateInspiration', () => {
        (0, globals_1.it)('should update inspiration successfully', async () => {
            const mockInspiration = {
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
            };
            const updatedInspiration = {
                ...mockInspiration,
                userDescription: 'New description',
            };
            mockRepository.findById.mockResolvedValue(mockInspiration);
            mockRepository.update.mockResolvedValue(updatedInspiration);
            const result = await service.updateInspiration('123', 'New description');
            (0, globals_1.expect)(result).toEqual(updatedInspiration);
            (0, globals_1.expect)(mockRepository.update).toHaveBeenCalledWith('123', { userDescription: 'New description' });
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith('Updated inspiration', globals_1.expect.objectContaining({
                inspirationId: '123',
            }));
        });
        (0, globals_1.it)('should throw error if inspiration not found', async () => {
            mockRepository.findById.mockResolvedValue(undefined);
            await (0, globals_1.expect)(service.updateInspiration('nonexistent', 'New description')).rejects.toThrow(app_error_1.AppError);
            await (0, globals_1.expect)(service.updateInspiration('nonexistent', 'New description')).rejects.toMatchObject({
                errorMessageCode: app_error_1.ErrorMessageCode.INSPIRATION_NOT_FOUND,
                httpCode: 404,
            });
        });
    });
    (0, globals_1.describe)('deleteInspiration', () => {
        (0, globals_1.it)('should delete inspiration successfully', async () => {
            const mockInspiration = {
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
            };
            mockRepository.findById.mockResolvedValue(mockInspiration);
            mockRepository.delete.mockResolvedValue(true);
            const result = await service.deleteInspiration('123');
            (0, globals_1.expect)(result).toBe(true);
            (0, globals_1.expect)(mockRepository.delete).toHaveBeenCalledWith('123');
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith('Deleted inspiration', globals_1.expect.objectContaining({
                inspirationId: '123',
            }));
        });
        (0, globals_1.it)('should delete S3 file if exists', async () => {
            const mockInspiration = {
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
            };
            mockRepository.findById.mockResolvedValue(mockInspiration);
            mockRepository.delete.mockResolvedValue(true);
            mockMediaUploader.delete.mockResolvedValue(undefined);
            await service.deleteInspiration('123');
            (0, globals_1.expect)(mockMediaUploader.delete).toHaveBeenCalledWith('https://s3.amazonaws.com/test.jpg');
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith('Deleted inspiration file from S3', globals_1.expect.objectContaining({
                imageUrl: 'https://s3.amazonaws.com/test.jpg',
            }));
        });
        (0, globals_1.it)('should continue with DB deletion if S3 deletion fails', async () => {
            const mockInspiration = {
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
            };
            mockRepository.findById.mockResolvedValue(mockInspiration);
            mockRepository.delete.mockResolvedValue(true);
            mockMediaUploader.delete.mockRejectedValue(new Error('S3 error'));
            const result = await service.deleteInspiration('123');
            (0, globals_1.expect)(result).toBe(true);
            (0, globals_1.expect)(mockLogger.warn).toHaveBeenCalledWith('Failed to delete file from S3, continuing with DB deletion', globals_1.expect.any(Object));
            (0, globals_1.expect)(mockRepository.delete).toHaveBeenCalled();
        });
        (0, globals_1.it)('should throw error if inspiration not found', async () => {
            mockRepository.findById.mockResolvedValue(undefined);
            await (0, globals_1.expect)(service.deleteInspiration('nonexistent')).rejects.toThrow(app_error_1.AppError);
            await (0, globals_1.expect)(service.deleteInspiration('nonexistent')).rejects.toMatchObject({
                errorMessageCode: app_error_1.ErrorMessageCode.INSPIRATION_NOT_FOUND,
                httpCode: 404,
            });
        });
    });
});
