import { z } from 'zod'

export const createWorkspaceSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: z.string().optional(),
})

export const updateWorkspaceSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: z.string().optional(),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>


