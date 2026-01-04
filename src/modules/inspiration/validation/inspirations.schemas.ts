import { z } from 'zod'

export const InspirationTypeSchema = z.enum(['image', 'link', 'text', 'document'])

export const InspirationStatusSchema = z.enum(['processing', 'completed', 'failed'])

export const TagCategorySchema = z.enum(['topic', 'format', 'tone', 'style', 'other'])

export const CreateInspirationSchema = z.object({
    type: InspirationTypeSchema,
    title: z.string().min(1).max(100),
    content: z.string().optional(),
    userDescription: z.string().max(1000).optional(),
})

export const validateInspirationByType = (data: { type: string; content?: string }) => {
    if (data.type === 'link') {
        if (!data.content) {
            throw new Error('content is required for type=link')
        }
        // Проверка валидности URL
        try {
            new URL(data.content)
        } catch {
            throw new Error('Invalid URL format')
        }
    }

    if (data.type === 'text') {
        if (!data.content || data.content.length < 10) {
            throw new Error('content must be at least 10 characters for type=text')
        }
    }
}

export const UpdateInspirationSchema = z.object({
    userDescription: z.string().max(1000),
})

export const GetInspirationsQuerySchema = z.object({
    type: InspirationTypeSchema.optional(),
    status: InspirationStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
})

export const CreateTagSchema = z.object({
    name: z.string().min(1).max(100),
    category: TagCategorySchema,
})

export const UpdateTagSchema = z.object({
    name: z.string().min(1).max(100),
})

export const GetTagsQuerySchema = z.object({
    category: TagCategorySchema.optional(),
    sortBy: z.enum(['name', 'usageCount']).default('usageCount'),
    order: z.enum(['asc', 'desc']).default('desc'),
})

export const MainPromptSchema = z.object({
    brandVoice: z.string().optional(),
    coreThemes: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
    contentGoals: z.array(z.string()).optional(),
    avoidTopics: z.array(z.string()).optional(),
    preferredFormats: z.array(z.string()).optional(),
    additionalContext: z.string().optional(),
})

export const UpdateMainPromptSchema = MainPromptSchema.partial()

export type CreateInspirationInput = z.infer<typeof CreateInspirationSchema>
export type UpdateInspirationInput = z.infer<typeof UpdateInspirationSchema>
export type GetInspirationsQuery = z.infer<typeof GetInspirationsQuerySchema>
export type CreateTagInput = z.infer<typeof CreateTagSchema>
export type UpdateTagInput = z.infer<typeof UpdateTagSchema>
export type GetTagsQuery = z.infer<typeof GetTagsQuerySchema>
export type MainPromptInput = z.infer<typeof MainPromptSchema>
export type UpdateMainPromptInput = z.infer<typeof UpdateMainPromptSchema>
