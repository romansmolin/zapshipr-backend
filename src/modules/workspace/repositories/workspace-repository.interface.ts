import type { InsertWorkspace, Workspace } from '../entity/workspace.schema'

export interface IWorkspaceRepository {
    create(data: InsertWorkspace): Promise<Workspace>
    findById(id: string): Promise<Workspace | undefined>
    findByUserId(userId: string): Promise<Workspace[]>
    update(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined>
    delete(id: string): Promise<void>
    updateAvatar(id: string, avatarUrl: string): Promise<Workspace | undefined>
}


