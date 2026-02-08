import type { WorkspaceDto } from '../entity/workspace.dto'
import type { CreateWorkspaceInput, UpdateWorkspaceInput, MainPrompt, UpdateMainPrompt } from '../validation/workspace.schemas'
import type { Onboarding, UpdateOnboardingInput } from '../validation/onboarding.schemas'
import type { WorkspaceAIContext } from '../entity/workspace-profile.types'

export interface IWorkspaceService {
    create(userId: string, data: CreateWorkspaceInput, file?: Express.Multer.File): Promise<WorkspaceDto>
    getById(id: string, userId: string): Promise<WorkspaceDto>
    getByUserId(userId: string): Promise<WorkspaceDto[]>
    getDefaultWorkspace(userId: string): Promise<WorkspaceDto | null>
    update(id: string, userId: string, data: UpdateWorkspaceInput, file?: Express.Multer.File): Promise<WorkspaceDto>
    delete(id: string, userId: string): Promise<void>
    getMainPrompt(workspaceId: string, userId: string): Promise<MainPrompt>
    updateMainPrompt(workspaceId: string, userId: string, data: UpdateMainPrompt): Promise<MainPrompt>
    getOnboarding(workspaceId: string, userId: string): Promise<Onboarding>
    updateOnboarding(workspaceId: string, userId: string, data: UpdateOnboardingInput): Promise<Onboarding>
    setDefaultWorkspace(workspaceId: string, userId: string): Promise<WorkspaceDto>
    verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void>
    getAIContext(workspaceId: string, userId: string): Promise<WorkspaceAIContext>
}
