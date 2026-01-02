import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { WorkspaceTagsRepository } from '../workspace-tags.repository'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { WorkspaceTag } from '../../entity/workspace-tag.schema'

describe('WorkspaceTagsRepository', () => {
    let repository: WorkspaceTagsRepository
    let mockDb: any
    let mockLogger: jest.Mocked<ILogger>

    beforeEach(() => {
        // Mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as any

        // Mock database
        mockDb = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            values: jest.fn().mockReturnThis(),
            returning: jest.fn(),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
        }

        repository = new WorkspaceTagsRepository(mockDb, mockLogger)
    })

    describe('findByWorkspaceId', () => {
        it('should find all tags for a workspace', async () => {
            const mockTags: WorkspaceTag[] = [
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
            ]

            mockDb.orderBy.mockResolvedValue(mockTags)

            const result = await repository.findByWorkspaceId('ws-1')

            expect(result).toEqual(mockTags)
            expect(mockDb.select).toHaveBeenCalled()
            expect(mockDb.from).toHaveBeenCalled()
            expect(mockDb.where).toHaveBeenCalled()
            expect(mockDb.orderBy).toHaveBeenCalled()
        })

        it('should apply category filter when provided', async () => {
            mockDb.orderBy.mockResolvedValue([])

            await repository.findByWorkspaceId('ws-1', { category: 'topic' })

            expect(mockDb.where).toHaveBeenCalled()
        })

        it('should apply sorting by name when specified', async () => {
            mockDb.orderBy.mockResolvedValue([])

            await repository.findByWorkspaceId('ws-1', { sortBy: 'name', order: 'asc' })

            expect(mockDb.orderBy).toHaveBeenCalled()
        })

        it('should apply sorting by usageCount by default', async () => {
            mockDb.orderBy.mockResolvedValue([])

            await repository.findByWorkspaceId('ws-1')

            expect(mockDb.orderBy).toHaveBeenCalled()
        })
    })

    describe('findByNameAndCategory', () => {
        it('should find tag by name and category', async () => {
            const mockTag: WorkspaceTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'marketing',
                category: 'topic',
                usageCount: 5,
                isUserCreated: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockDb.limit.mockResolvedValue([mockTag])

            const result = await repository.findByNameAndCategory('ws-1', 'marketing', 'topic')

            expect(result).toEqual(mockTag)
            expect(mockDb.select).toHaveBeenCalled()
            expect(mockDb.where).toHaveBeenCalled()
            expect(mockDb.limit).toHaveBeenCalledWith(1)
        })

        it('should return undefined if tag not found', async () => {
            mockDb.limit.mockResolvedValue([])

            const result = await repository.findByNameAndCategory('ws-1', 'nonexistent', 'topic')

            expect(result).toBeUndefined()
        })
    })

    describe('create', () => {
        it('should create a new tag', async () => {
            const mockTag: WorkspaceTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'marketing',
                category: 'topic',
                usageCount: 1,
                isUserCreated: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockDb.returning.mockResolvedValue([mockTag])

            const result = await repository.create({
                workspaceId: 'ws-1',
                name: 'marketing',
                category: 'topic',
                isUserCreated: true,
            })

            expect(result).toEqual(mockTag)
            expect(mockDb.insert).toHaveBeenCalled()
            expect(mockDb.values).toHaveBeenCalled()
            expect(mockDb.returning).toHaveBeenCalled()
        })

        it('should create tag without explicit usageCount (uses DB default)', async () => {
            const mockTag: WorkspaceTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'test',
                category: 'topic',
                usageCount: 0,
                isUserCreated: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockDb.returning.mockResolvedValue([mockTag])

            const result = await repository.create({
                workspaceId: 'ws-1',
                name: 'test',
                category: 'topic',
                isUserCreated: false,
            })

            expect(result.usageCount).toBe(0)
            expect(mockDb.insert).toHaveBeenCalled()
            expect(mockDb.values).toHaveBeenCalled()
        })
    })

    describe('update', () => {
        it('should update tag', async () => {
            const mockUpdatedTag: WorkspaceTag = {
                id: '1',
                workspaceId: 'ws-1',
                name: 'updated-name',
                category: 'topic',
                usageCount: 5,
                isUserCreated: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            mockDb.returning.mockResolvedValue([mockUpdatedTag])

            const result = await repository.update('1', { name: 'updated-name' })

            expect(result).toEqual(mockUpdatedTag)
            expect(mockDb.update).toHaveBeenCalled()
            expect(mockDb.set).toHaveBeenCalled()
            expect(mockDb.where).toHaveBeenCalled()
            expect(mockDb.returning).toHaveBeenCalled()
        })
    })

    describe('delete', () => {
        it('should delete tag', async () => {
            mockDb.returning.mockResolvedValue([{ id: '1' }])

            const result = await repository.delete('1')

            expect(result).toBe(true)
            expect(mockDb.delete).toHaveBeenCalled()
            expect(mockDb.where).toHaveBeenCalled()
            expect(mockDb.returning).toHaveBeenCalled()
        })

        it('should return false if tag not found', async () => {
            mockDb.returning.mockResolvedValue([])

            const result = await repository.delete('nonexistent')

            expect(result).toBe(false)
        })
    })

    describe('incrementUsageCount', () => {
        it('should increment tag usage count', async () => {
            mockDb.where.mockResolvedValue(undefined)

            await repository.incrementUsageCount('1')

            expect(mockDb.update).toHaveBeenCalled()
            expect(mockDb.set).toHaveBeenCalled()
            expect(mockDb.where).toHaveBeenCalled()
        })

        it('should use SQL increment expression', async () => {
            mockDb.where.mockResolvedValue(undefined)

            await repository.incrementUsageCount('1')

            // Verify that set was called (which includes SQL increment)
            expect(mockDb.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    updatedAt: expect.any(Date),
                })
            )
        })
    })
})

