import type { WorkspaceTag, InsertWorkspaceTag } from '../entity/workspace-tag.schema'

export interface IWorkspaceTagsRepository {
    findByWorkspaceId(
        workspaceId: string,
        filters?: {
            category?: 'topic' | 'format' | 'tone' | 'style' | 'other'
            sortBy?: 'name' | 'usageCount'
            order?: 'asc' | 'desc'
        }
    ): Promise<WorkspaceTag[]>
    findByNameAndCategory(workspaceId: string, name: string, category: string): Promise<WorkspaceTag | undefined>
    create(data: InsertWorkspaceTag): Promise<WorkspaceTag>
    update(id: string, data: Partial<InsertWorkspaceTag>): Promise<WorkspaceTag | undefined>
    delete(id: string): Promise<boolean>
    incrementUsageCount(id: string): Promise<void>
}

