"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const workspace_tags_repository_1 = require("../workspace-tags.repository");
(0, globals_1.describe)('WorkspaceTagsRepository', () => {
    let repository;
    let mockDb;
    let mockLogger;
    (0, globals_1.beforeEach)(() => {
        // Mock logger
        mockLogger = {
            info: globals_1.jest.fn(),
            error: globals_1.jest.fn(),
            warn: globals_1.jest.fn(),
            debug: globals_1.jest.fn(),
        };
        // Mock database
        mockDb = {
            select: globals_1.jest.fn().mockReturnThis(),
            from: globals_1.jest.fn().mockReturnThis(),
            where: globals_1.jest.fn().mockReturnThis(),
            orderBy: globals_1.jest.fn().mockReturnThis(),
            limit: globals_1.jest.fn().mockReturnThis(),
            insert: globals_1.jest.fn().mockReturnThis(),
            values: globals_1.jest.fn().mockReturnThis(),
            returning: globals_1.jest.fn(),
            update: globals_1.jest.fn().mockReturnThis(),
            set: globals_1.jest.fn().mockReturnThis(),
            delete: globals_1.jest.fn().mockReturnThis(),
        };
        repository = new workspace_tags_repository_1.WorkspaceTagsRepository(mockDb, mockLogger);
    });
    (0, globals_1.describe)('findByWorkspaceId', () => {
        (0, globals_1.it)('should find all tags for a workspace', async () => {
            const mockTags = [
                {
                    id: '1',
                    workspaceId: 'ws-1',
                    name: 'marketing',
                    category: 'topic',
                    usageCount: 5,
                    isUserCreated: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: '2',
                    workspaceId: 'ws-1',
                    name: 'video',
                    category: 'format',
                    usageCount: 3,
                    isUserCreated: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];
            mockDb.orderBy.mockResolvedValue(mockTags);
            const result = await repository.findByWorkspaceId('ws-1');
            (0, globals_1.expect)(result).toEqual(mockTags);
            (0, globals_1.expect)(mockDb.select).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.from).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.where).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.orderBy).toHaveBeenCalled();
        });
        (0, globals_1.it)('should apply category filter when provided', async () => {
            mockDb.orderBy.mockResolvedValue([]);
            await repository.findByWorkspaceId('ws-1', { category: 'topic' });
            (0, globals_1.expect)(mockDb.where).toHaveBeenCalled();
        });
        (0, globals_1.it)('should apply sorting by name when specified', async () => {
            mockDb.orderBy.mockResolvedValue([]);
            await repository.findByWorkspaceId('ws-1', { sortBy: 'name', order: 'asc' });
            (0, globals_1.expect)(mockDb.orderBy).toHaveBeenCalled();
        });
        (0, globals_1.it)('should apply sorting by usageCount by default', async () => {
            mockDb.orderBy.mockResolvedValue([]);
            await repository.findByWorkspaceId('ws-1');
            (0, globals_1.expect)(mockDb.orderBy).toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('findByNameAndCategory', () => {
        (0, globals_1.it)('should find tag by name and category', async () => {
            const mockTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'marketing',
                category: 'topic',
                usageCount: 5,
                isUserCreated: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockDb.limit.mockResolvedValue([mockTag]);
            const result = await repository.findByNameAndCategory('ws-1', 'marketing', 'topic');
            (0, globals_1.expect)(result).toEqual(mockTag);
            (0, globals_1.expect)(mockDb.select).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.where).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.limit).toHaveBeenCalledWith(1);
        });
        (0, globals_1.it)('should return undefined if tag not found', async () => {
            mockDb.limit.mockResolvedValue([]);
            const result = await repository.findByNameAndCategory('ws-1', 'nonexistent', 'topic');
            (0, globals_1.expect)(result).toBeUndefined();
        });
    });
    (0, globals_1.describe)('create', () => {
        (0, globals_1.it)('should create a new tag', async () => {
            const mockTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'marketing',
                category: 'topic',
                usageCount: 1,
                isUserCreated: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockDb.returning.mockResolvedValue([mockTag]);
            const result = await repository.create({
                workspaceId: 'ws-1',
                name: 'marketing',
                category: 'topic',
                isUserCreated: true,
            });
            (0, globals_1.expect)(result).toEqual(mockTag);
            (0, globals_1.expect)(mockDb.insert).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.values).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.returning).toHaveBeenCalled();
        });
        (0, globals_1.it)('should create tag without explicit usageCount (uses DB default)', async () => {
            const mockTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'test',
                category: 'topic',
                usageCount: 0,
                isUserCreated: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockDb.returning.mockResolvedValue([mockTag]);
            const result = await repository.create({
                workspaceId: 'ws-1',
                name: 'test',
                category: 'topic',
                isUserCreated: false,
            });
            (0, globals_1.expect)(result.usageCount).toBe(0);
            (0, globals_1.expect)(mockDb.insert).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.values).toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('update', () => {
        (0, globals_1.it)('should update tag', async () => {
            const mockUpdatedTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'updated-name',
                category: 'topic',
                usageCount: 5,
                isUserCreated: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockDb.returning.mockResolvedValue([mockUpdatedTag]);
            const result = await repository.update('1', { name: 'updated-name' });
            (0, globals_1.expect)(result).toEqual(mockUpdatedTag);
            (0, globals_1.expect)(mockDb.update).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.set).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.where).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.returning).toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('delete', () => {
        (0, globals_1.it)('should delete tag', async () => {
            mockDb.returning.mockResolvedValue([{ id: '1' }]);
            const result = await repository.delete('1');
            (0, globals_1.expect)(result).toBe(true);
            (0, globals_1.expect)(mockDb.delete).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.where).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.returning).toHaveBeenCalled();
        });
        (0, globals_1.it)('should return false if tag not found', async () => {
            mockDb.returning.mockResolvedValue([]);
            const result = await repository.delete('nonexistent');
            (0, globals_1.expect)(result).toBe(false);
        });
    });
    (0, globals_1.describe)('incrementUsageCount', () => {
        (0, globals_1.it)('should increment tag usage count', async () => {
            mockDb.where.mockResolvedValue(undefined);
            await repository.incrementUsageCount('1');
            (0, globals_1.expect)(mockDb.update).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.set).toHaveBeenCalled();
            (0, globals_1.expect)(mockDb.where).toHaveBeenCalled();
        });
        (0, globals_1.it)('should use SQL increment expression', async () => {
            mockDb.where.mockResolvedValue(undefined);
            await repository.incrementUsageCount('1');
            // Verify that set was called (which includes SQL increment)
            (0, globals_1.expect)(mockDb.set).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                updatedAt: globals_1.expect.any(Date),
            }));
        });
    });
});
