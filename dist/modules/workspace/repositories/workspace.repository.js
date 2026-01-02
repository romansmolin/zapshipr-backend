"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const workspace_schema_1 = require("../entity/workspace.schema");
class WorkspaceRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async create(data) {
        this.logger.info('Creating workspace', { name: data.name, userId: data.userId });
        const [workspace] = await this.db
            .insert(workspace_schema_1.workspaces)
            .values({
            ...data,
            updatedAt: new Date(),
        })
            .returning();
        this.logger.info('Workspace created', { workspaceId: workspace.id });
        return workspace;
    }
    async findById(id) {
        this.logger.info('Finding workspace by id', { workspaceId: id });
        const [workspace] = await this.db.select().from(workspace_schema_1.workspaces).where((0, drizzle_orm_1.eq)(workspace_schema_1.workspaces.id, id));
        return workspace;
    }
    async findByUserId(userId) {
        this.logger.info('Finding workspaces by user id', { userId });
        const userWorkspaces = await this.db.select().from(workspace_schema_1.workspaces).where((0, drizzle_orm_1.eq)(workspace_schema_1.workspaces.userId, userId));
        return userWorkspaces;
    }
    async update(id, data) {
        this.logger.info('Updating workspace', { workspaceId: id });
        const [workspace] = await this.db
            .update(workspace_schema_1.workspaces)
            .set({
            ...data,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(workspace_schema_1.workspaces.id, id))
            .returning();
        return workspace;
    }
    async delete(id) {
        this.logger.info('Deleting workspace', { workspaceId: id });
        await this.db.delete(workspace_schema_1.workspaces).where((0, drizzle_orm_1.eq)(workspace_schema_1.workspaces.id, id));
        this.logger.info('Workspace deleted', { workspaceId: id });
    }
    async updateAvatar(id, avatarUrl) {
        this.logger.info('Updating workspace avatar', { workspaceId: id });
        const [workspace] = await this.db
            .update(workspace_schema_1.workspaces)
            .set({
            avatarUrl,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(workspace_schema_1.workspaces.id, id))
            .returning();
        return workspace;
    }
    async updateMainPrompt(id, mainPrompt) {
        this.logger.info('Updating workspace main prompt', { workspaceId: id });
        const [workspace] = await this.db
            .update(workspace_schema_1.workspaces)
            .set({
            mainPrompt,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(workspace_schema_1.workspaces.id, id))
            .returning();
        return workspace;
    }
}
exports.WorkspaceRepository = WorkspaceRepository;
