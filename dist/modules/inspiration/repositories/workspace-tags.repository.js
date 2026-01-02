"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceTagsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const forma_error_1 = require("@/shared/utils/forma-error");
const workspace_tag_schema_1 = require("../entity/workspace-tag.schema");
class WorkspaceTagsRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async findByWorkspaceId(workspaceId, filters) {
        try {
            const conditions = [(0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.workspaceId, workspaceId)];
            if (filters?.category) {
                conditions.push((0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.category, filters.category));
            }
            const whereClause = (0, drizzle_orm_1.and)(...conditions);
            // Determine sort order
            const sortBy = filters?.sortBy ?? 'usageCount';
            const order = filters?.order ?? 'desc';
            const orderByClause = sortBy === 'name'
                ? order === 'asc'
                    ? (0, drizzle_orm_1.asc)(workspace_tag_schema_1.workspaceTags.name)
                    : (0, drizzle_orm_1.desc)(workspace_tag_schema_1.workspaceTags.name)
                : order === 'asc'
                    ? (0, drizzle_orm_1.asc)(workspace_tag_schema_1.workspaceTags.usageCount)
                    : (0, drizzle_orm_1.desc)(workspace_tag_schema_1.workspaceTags.usageCount);
            const tags = await this.db.select().from(workspace_tag_schema_1.workspaceTags).where(whereClause).orderBy(orderByClause);
            return tags;
        }
        catch (error) {
            this.logger.error('Failed to fetch workspace tags', {
                operation: 'WorkspaceTagsRepository.findByWorkspaceId',
                entity: 'workspace_tags',
                workspaceId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async findByNameAndCategory(workspaceId, name, category) {
        try {
            const [tag] = await this.db
                .select()
                .from(workspace_tag_schema_1.workspaceTags)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.workspaceId, workspaceId), (0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.name, name), (0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.category, category)))
                .limit(1);
            return tag;
        }
        catch (error) {
            this.logger.error('Failed to find tag by name and category', {
                operation: 'WorkspaceTagsRepository.findByNameAndCategory',
                entity: 'workspace_tags',
                workspaceId,
                name,
                category,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async create(data) {
        try {
            const [tag] = await this.db
                .insert(workspace_tag_schema_1.workspaceTags)
                .values({
                ...data,
                updatedAt: new Date(),
            })
                .returning();
            this.logger.info('Created workspace tag', {
                operation: 'WorkspaceTagsRepository.create',
                entity: 'workspace_tags',
                tagId: tag.id,
                workspaceId: tag.workspaceId,
                name: tag.name,
                category: tag.category,
            });
            return tag;
        }
        catch (error) {
            this.logger.error('Failed to create workspace tag', {
                operation: 'WorkspaceTagsRepository.create',
                entity: 'workspace_tags',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async update(id, data) {
        try {
            const [updated] = await this.db
                .update(workspace_tag_schema_1.workspaceTags)
                .set({
                ...data,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.id, id))
                .returning();
            if (updated) {
                this.logger.info('Updated workspace tag', {
                    operation: 'WorkspaceTagsRepository.update',
                    entity: 'workspace_tags',
                    tagId: id,
                });
            }
            return updated;
        }
        catch (error) {
            this.logger.error('Failed to update workspace tag', {
                operation: 'WorkspaceTagsRepository.update',
                entity: 'workspace_tags',
                tagId: id,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async delete(id) {
        try {
            const result = await this.db.delete(workspace_tag_schema_1.workspaceTags).where((0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.id, id)).returning();
            const deleted = result.length > 0;
            if (deleted) {
                this.logger.info('Deleted workspace tag', {
                    operation: 'WorkspaceTagsRepository.delete',
                    entity: 'workspace_tags',
                    tagId: id,
                });
            }
            return deleted;
        }
        catch (error) {
            this.logger.error('Failed to delete workspace tag', {
                operation: 'WorkspaceTagsRepository.delete',
                entity: 'workspace_tags',
                tagId: id,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async incrementUsageCount(id) {
        try {
            await this.db
                .update(workspace_tag_schema_1.workspaceTags)
                .set({
                usageCount: (0, drizzle_orm_1.sql) `${workspace_tag_schema_1.workspaceTags.usageCount} + 1`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(workspace_tag_schema_1.workspaceTags.id, id));
            this.logger.info('Incremented tag usage count', {
                operation: 'WorkspaceTagsRepository.incrementUsageCount',
                entity: 'workspace_tags',
                tagId: id,
            });
        }
        catch (error) {
            this.logger.error('Failed to increment tag usage count', {
                operation: 'WorkspaceTagsRepository.incrementUsageCount',
                entity: 'workspace_tags',
                tagId: id,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
}
exports.WorkspaceTagsRepository = WorkspaceTagsRepository;
