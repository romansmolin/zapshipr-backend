import type { Workspace } from './workspace.schema'
import type { Onboarding } from '../validation/onboarding.schemas'

export interface WorkspaceDto {
    id: string
    userId: string
    name: string
    description: string | null
    avatarUrl: string | null
    isDefault: boolean
    onboarding: Onboarding | null
    createdAt: Date
    updatedAt: Date
}

export const toWorkspaceDto = (workspace: Workspace): WorkspaceDto => ({
    id: workspace.id,
    userId: workspace.userId,
    name: workspace.name,
    description: workspace.description,
    avatarUrl: workspace.avatarUrl,
    isDefault: workspace.isDefault,
    onboarding: workspace.onboarding as Onboarding | null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
})


