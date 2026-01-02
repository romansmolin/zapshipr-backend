import type { Workspace } from './workspace.schema'

export interface WorkspaceDto {
    id: string
    userId: string
    name: string
    description: string | null
    avatarUrl: string | null
    createdAt: Date
    updatedAt: Date
}

export const toWorkspaceDto = (workspace: Workspace): WorkspaceDto => ({
    id: workspace.id,
    userId: workspace.userId,
    name: workspace.name,
    description: workspace.description,
    avatarUrl: workspace.avatarUrl,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
})


