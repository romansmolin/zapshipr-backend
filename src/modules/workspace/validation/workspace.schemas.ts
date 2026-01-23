import { z } from 'zod'

export const createWorkspaceSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: z.string().optional(),
})

export const updateWorkspaceSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: z.string().optional(),
})

export const mainPromptSchema = z.object({
    brandVoice: z.string().optional(),
    coreThemes: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
    contentGoals: z.array(z.string()).optional(),
    avoidTopics: z.array(z.string()).optional(),
    preferredFormats: z.array(z.string()).optional(),
    additionalContext: z.string().optional(),
})

export const updateMainPromptSchema = z.object({
    brandVoice: z.string().optional(),
    coreThemes: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
    contentGoals: z.array(z.string()).optional(),
    avoidTopics: z.array(z.string()).optional(),
    preferredFormats: z.array(z.string()).optional(),
    additionalContext: z.string().optional(),
})

export const workspaceIdParamSchema = z.object({
    workspaceId: z.string().uuid('Invalid workspace ID format'),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type MainPrompt = z.infer<typeof mainPromptSchema>
export type UpdateMainPrompt = z.infer<typeof updateMainPromptSchema>
export type WorkspaceIdParam = z.infer<typeof workspaceIdParamSchema>


