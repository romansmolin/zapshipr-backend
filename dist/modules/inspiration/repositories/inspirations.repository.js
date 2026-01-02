"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspirationsRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const forma_error_1 = require("@/shared/utils/forma-error");
const raw_inspiration_schema_1 = require("../entity/raw-inspiration.schema");
class InspirationsRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async create(data) {
        try {
            const [inspiration] = await this.db
                .insert(raw_inspiration_schema_1.rawInspirations)
                .values({
                ...data,
                updatedAt: new Date(),
            })
                .returning();
            this.logger.info('Created raw inspiration', {
                operation: 'InspirationsRepository.create',
                entity: 'raw_inspirations',
                inspirationId: inspiration.id,
                workspaceId: inspiration.workspaceId,
                type: inspiration.type,
            });
            return inspiration;
        }
        catch (error) {
            this.logger.error('Failed to create raw inspiration', {
                operation: 'InspirationsRepository.create',
                entity: 'raw_inspirations',
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async findById(id) {
        try {
            const [inspiration] = await this.db
                .select()
                .from(raw_inspiration_schema_1.rawInspirations)
                .where((0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.id, id))
                .limit(1);
            return inspiration;
        }
        catch (error) {
            this.logger.error('Failed to fetch inspiration by id', {
                operation: 'InspirationsRepository.findById',
                entity: 'raw_inspirations',
                inspirationId: id,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async findByWorkspaceId(workspaceId, filters) {
        try {
            const limit = filters?.limit ?? 20;
            const offset = filters?.offset ?? 0;
            // Build where conditions
            const conditions = [(0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.workspaceId, workspaceId)];
            if (filters?.type) {
                conditions.push((0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.type, filters.type));
            }
            if (filters?.status) {
                conditions.push((0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.status, filters.status));
            }
            const whereClause = (0, drizzle_orm_1.and)(...conditions);
            // Fetch items
            const items = await this.db
                .select()
                .from(raw_inspiration_schema_1.rawInspirations)
                .where(whereClause)
                .orderBy((0, drizzle_orm_1.desc)(raw_inspiration_schema_1.rawInspirations.createdAt))
                .limit(limit)
                .offset(offset);
            // Count total
            const [{ value: total }] = await this.db
                .select({ value: (0, drizzle_orm_1.count)() })
                .from(raw_inspiration_schema_1.rawInspirations)
                .where(whereClause);
            return { items, total };
        }
        catch (error) {
            this.logger.error('Failed to fetch inspirations by workspace', {
                operation: 'InspirationsRepository.findByWorkspaceId',
                entity: 'raw_inspirations',
                workspaceId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async update(id, data) {
        try {
            const [updated] = await this.db
                .update(raw_inspiration_schema_1.rawInspirations)
                .set({
                ...data,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.id, id))
                .returning();
            if (updated) {
                this.logger.info('Updated raw inspiration', {
                    operation: 'InspirationsRepository.update',
                    entity: 'raw_inspirations',
                    inspirationId: id,
                });
            }
            return updated;
        }
        catch (error) {
            this.logger.error('Failed to update inspiration', {
                operation: 'InspirationsRepository.update',
                entity: 'raw_inspirations',
                inspirationId: id,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async delete(id) {
        try {
            const result = await this.db.delete(raw_inspiration_schema_1.rawInspirations).where((0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.id, id)).returning();
            const deleted = result.length > 0;
            if (deleted) {
                this.logger.info('Deleted raw inspiration', {
                    operation: 'InspirationsRepository.delete',
                    entity: 'raw_inspirations',
                    inspirationId: id,
                });
            }
            return deleted;
        }
        catch (error) {
            this.logger.error('Failed to delete inspiration', {
                operation: 'InspirationsRepository.delete',
                entity: 'raw_inspirations',
                inspirationId: id,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
    async checkDuplicateUrl(workspaceId, url) {
        try {
            const [existing] = await this.db
                .select({ id: raw_inspiration_schema_1.rawInspirations.id })
                .from(raw_inspiration_schema_1.rawInspirations)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.workspaceId, workspaceId), (0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.content, url), (0, drizzle_orm_1.eq)(raw_inspiration_schema_1.rawInspirations.type, 'link')))
                .limit(1);
            return !!existing;
        }
        catch (error) {
            this.logger.error('Failed to check duplicate URL', {
                operation: 'InspirationsRepository.checkDuplicateUrl',
                entity: 'raw_inspirations',
                workspaceId,
                error: (0, forma_error_1.formatError)(error),
            });
            throw error;
        }
    }
}
exports.InspirationsRepository = InspirationsRepository;
