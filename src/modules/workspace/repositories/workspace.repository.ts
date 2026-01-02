import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { DBSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger'

import type { InsertWorkspace, Workspace } from '../entity/workspace.schema'
import { workspaces } from '../entity/workspace.schema'
import type { IWorkspaceRepository } from './workspace-repository.interface'

export class WorkspaceRepository implements IWorkspaceRepository {
    constructor(
        private db: NodePgDatabase<DBSchema>,
        private logger: ILogger
    ) {}

    async create(data: InsertWorkspace): Promise<Workspace> {
        this.logger.info('Creating workspace', { name: data.name, userId: data.userId })

        const [workspace] = await this.db
            .insert(workspaces)
            .values({
                ...data,
                updatedAt: new Date(),
            })
            .returning()

        this.logger.info('Workspace created', { workspaceId: workspace.id })

        return workspace
    }

    async findById(id: string): Promise<Workspace | undefined> {
        this.logger.info('Finding workspace by id', { workspaceId: id })

        const [workspace] = await this.db.select().from(workspaces).where(eq(workspaces.id, id))

        return workspace
    }

    async findByUserId(userId: string): Promise<Workspace[]> {
        this.logger.info('Finding workspaces by user id', { userId })

        const userWorkspaces = await this.db.select().from(workspaces).where(eq(workspaces.userId, userId))

        return userWorkspaces
    }

    async update(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
        this.logger.info('Updating workspace', { workspaceId: id })

        const [workspace] = await this.db
            .update(workspaces)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(workspaces.id, id))
            .returning()

        return workspace
    }

    async delete(id: string): Promise<void> {
        this.logger.info('Deleting workspace', { workspaceId: id })

        await this.db.delete(workspaces).where(eq(workspaces.id, id))

        this.logger.info('Workspace deleted', { workspaceId: id })
    }

    async updateAvatar(id: string, avatarUrl: string): Promise<Workspace | undefined> {
        this.logger.info('Updating workspace avatar', { workspaceId: id })

        const [workspace] = await this.db
            .update(workspaces)
            .set({
                avatarUrl,
                updatedAt: new Date(),
            })
            .where(eq(workspaces.id, id))
            .returning()

        return workspace
    }

    async updateMainPrompt(id: string, mainPrompt: any): Promise<Workspace | undefined> {
        this.logger.info('Updating workspace main prompt', { workspaceId: id })

        const [workspace] = await this.db
            .update(workspaces)
            .set({
                mainPrompt,
                updatedAt: new Date(),
            })
            .where(eq(workspaces.id, id))
            .returning()

        return workspace
    }
}


