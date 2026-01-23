import type { InsertWorkspace, Workspace } from '../entity/workspace.schema'
import type { MainPrompt } from '../validation/workspace.schemas'

export interface IWorkspaceRepository {
    create(data: InsertWorkspace): Promise<Workspace>
    findById(id: string): Promise<Workspace | undefined>
    findByIdAndUserId(id: string, userId: string): Promise<Workspace | undefined>
    findByUserId(userId: string): Promise<Workspace[]>
    findDefaultByUserId(userId: string): Promise<Workspace | undefined>
    countByUserId(userId: string): Promise<number>
    update(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined>
    delete(id: string): Promise<void>
    updateMainPrompt(id: string, mainPrompt: MainPrompt): Promise<Workspace | undefined>
    setAsDefault(workspaceId: string, userId: string): Promise<Workspace | undefined>
}


