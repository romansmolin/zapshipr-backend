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

/**
 * Ensures formType exists in onboarding meta for backwards compatibility.
 * For legacy workspaces without formType, derives it from completionLevel.
 */
function ensureFormType(onboarding: Onboarding): Onboarding {
    if (!onboarding.meta.formType) {
        return {
            ...onboarding,
            meta: {
                ...onboarding.meta,
                formType: onboarding.meta.completionLevel === 'quick_start' ? 'quick' : 'complex',
            },
        }
    }
    return onboarding
}

export const toWorkspaceDto = (workspace: Workspace): WorkspaceDto => {
    const onboarding = workspace.onboarding as Onboarding | null

    return {
        id: workspace.id,
        userId: workspace.userId,
        name: workspace.name,
        description: workspace.description,
        avatarUrl: workspace.avatarUrl,
        isDefault: workspace.isDefault,
        onboarding: onboarding ? ensureFormType(onboarding) : null,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
    }
}


