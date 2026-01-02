import { eq, and, asc, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'

import { workspaceTags } from '../entity/workspace-tag.schema'
import type { WorkspaceTag, InsertWorkspaceTag } from '../entity/workspace-tag.schema'
import type { IWorkspaceTagsRepository } from './workspace-tags-repository.interface'

export class WorkspaceTagsRepository implements IWorkspaceTagsRepository {
    private readonly db: NodePgDatabase<typeof dbSchema>
    private readonly logger: ILogger

    constructor(db: NodePgDatabase<typeof dbSchema>, logger: ILogger) {
        this.db = db
        this.logger = logger
    }

    async findByWorkspaceId(
        workspaceId: string,
        filters?: {
            category?: 'topic' | 'format' | 'tone' | 'style' | 'other'
            sortBy?: 'name' | 'usageCount'
            order?: 'asc' | 'desc'
        }
    ): Promise<WorkspaceTag[]> {
        try {
            const conditions = [eq(workspaceTags.workspaceId, workspaceId)]

            if (filters?.category) {
                conditions.push(eq(workspaceTags.category, filters.category))
            }

            const whereClause = and(...conditions)

            // Determine sort order
            const sortBy = filters?.sortBy ?? 'usageCount'
            const order = filters?.order ?? 'desc'

            const orderByClause =
                sortBy === 'name'
                    ? order === 'asc'
                        ? asc(workspaceTags.name)
                        : desc(workspaceTags.name)
                    : order === 'asc'
                      ? asc(workspaceTags.usageCount)
                      : desc(workspaceTags.usageCount)

            const tags = await this.db.select().from(workspaceTags).where(whereClause).orderBy(orderByClause)

            return tags
        } catch (error) {
            this.logger.error('Failed to fetch workspace tags', {
                operation: 'WorkspaceTagsRepository.findByWorkspaceId',
                entity: 'workspace_tags',
                workspaceId,
                error: formatError(error),
            })
            throw error
        }
    }

    async findByNameAndCategory(
        workspaceId: string,
        name: string,
        category: string
    ): Promise<WorkspaceTag | undefined> {
        try {
            const [tag] = await this.db
                .select()
                .from(workspaceTags)
                .where(
                    and(
                        eq(workspaceTags.workspaceId, workspaceId),
                        eq(workspaceTags.name, name),
                        eq(workspaceTags.category, category as WorkspaceTag['category'])
                    )
                )
                .limit(1)

            return tag
        } catch (error) {
            this.logger.error('Failed to find tag by name and category', {
                operation: 'WorkspaceTagsRepository.findByNameAndCategory',
                entity: 'workspace_tags',
                workspaceId,
                name,
                category,
                error: formatError(error),
            })
            throw error
        }
    }

    async create(data: InsertWorkspaceTag): Promise<WorkspaceTag> {
        try {
            const [tag] = await this.db
                .insert(workspaceTags)
                .values({
                    ...data,
                    updatedAt: new Date(),
                })
                .returning()

            this.logger.info('Created workspace tag', {
                operation: 'WorkspaceTagsRepository.create',
                entity: 'workspace_tags',
                tagId: tag.id,
                workspaceId: tag.workspaceId,
                name: tag.name,
                category: tag.category,
            })

            return tag
        } catch (error) {
            this.logger.error('Failed to create workspace tag', {
                operation: 'WorkspaceTagsRepository.create',
                entity: 'workspace_tags',
                error: formatError(error),
            })
            throw error
        }
    }

    async update(id: string, data: Partial<InsertWorkspaceTag>): Promise<WorkspaceTag | undefined> {
        try {
            const [updated] = await this.db
                .update(workspaceTags)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(workspaceTags.id, id))
                .returning()

            if (updated) {
                this.logger.info('Updated workspace tag', {
                    operation: 'WorkspaceTagsRepository.update',
                    entity: 'workspace_tags',
                    tagId: id,
                })
            }

            return updated
        } catch (error) {
            this.logger.error('Failed to update workspace tag', {
                operation: 'WorkspaceTagsRepository.update',
                entity: 'workspace_tags',
                tagId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const result = await this.db.delete(workspaceTags).where(eq(workspaceTags.id, id)).returning()

            const deleted = result.length > 0

            if (deleted) {
                this.logger.info('Deleted workspace tag', {
                    operation: 'WorkspaceTagsRepository.delete',
                    entity: 'workspace_tags',
                    tagId: id,
                })
            }

            return deleted
        } catch (error) {
            this.logger.error('Failed to delete workspace tag', {
                operation: 'WorkspaceTagsRepository.delete',
                entity: 'workspace_tags',
                tagId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async incrementUsageCount(id: string): Promise<void> {
        try {
            await this.db
                .update(workspaceTags)
                .set({
                    usageCount: sql`${workspaceTags.usageCount} + 1`,
                    updatedAt: new Date(),
                })
                .where(eq(workspaceTags.id, id))

            this.logger.info('Incremented tag usage count', {
                operation: 'WorkspaceTagsRepository.incrementUsageCount',
                entity: 'workspace_tags',
                tagId: id,
            })
        } catch (error) {
            this.logger.error('Failed to increment tag usage count', {
                operation: 'WorkspaceTagsRepository.incrementUsageCount',
                entity: 'workspace_tags',
                tagId: id,
                error: formatError(error),
            })
            throw error
        }
    }
}
