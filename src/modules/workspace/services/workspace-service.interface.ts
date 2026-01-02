import type { WorkspaceDto } from '../entity/workspace.dto'
import type { CreateWorkspaceInput, UpdateWorkspaceInput, MainPrompt, UpdateMainPrompt } from '../validation/workspace.schemas'

export interface IWorkspaceService {
    create(userId: string, data: CreateWorkspaceInput): Promise<WorkspaceDto>
    getById(id: string, userId: string): Promise<WorkspaceDto>
    getByUserId(userId: string): Promise<WorkspaceDto[]>
    update(id: string, userId: string, data: UpdateWorkspaceInput): Promise<WorkspaceDto>
    delete(id: string, userId: string): Promise<void>
    updateAvatar(id: string, userId: string, file: Express.Multer.File): Promise<WorkspaceDto>
    getMainPrompt(workspaceId: string, userId: string): Promise<MainPrompt>
    updateMainPrompt(workspaceId: string, userId: string, data: UpdateMainPrompt): Promise<MainPrompt>
}


