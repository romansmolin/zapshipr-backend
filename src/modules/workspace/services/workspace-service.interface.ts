import type { WorkspaceDto } from '../entity/workspace.dto'
import type { CreateWorkspaceInput, UpdateWorkspaceInput, MainPrompt, UpdateMainPrompt } from '../validation/workspace.schemas'

export interface IWorkspaceService {
    create(userId: string, data: CreateWorkspaceInput): Promise<WorkspaceDto>
    getById(id: string, userId: string): Promise<WorkspaceDto>
    getByUserId(userId: string): Promise<WorkspaceDto[]>
    getDefaultWorkspace(userId: string): Promise<WorkspaceDto | null>
    update(id: string, userId: string, data: UpdateWorkspaceInput): Promise<WorkspaceDto>
    delete(id: string, userId: string): Promise<void>
    getMainPrompt(workspaceId: string, userId: string): Promise<MainPrompt>
    updateMainPrompt(workspaceId: string, userId: string, data: UpdateMainPrompt): Promise<MainPrompt>
    setDefaultWorkspace(workspaceId: string, userId: string): Promise<WorkspaceDto>
}


