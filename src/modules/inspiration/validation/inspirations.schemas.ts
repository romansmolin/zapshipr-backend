import { z } from 'zod'

// Enum для типов вдохновений
export const InspirationTypeSchema = z.enum(['image', 'link', 'text', 'document'])

// Enum для статусов
export const InspirationStatusSchema = z.enum(['processing', 'completed', 'failed'])

// Enum для категорий тегов
export const TagCategorySchema = z.enum(['topic', 'format', 'tone', 'style', 'other'])

// Schema для создания inspiration
export const CreateInspirationSchema = z.object({
    type: InspirationTypeSchema,
    content: z.string().optional(), // URL или текст
    userDescription: z.string().max(1000).optional(),
    // file будет обрабатываться через multer middleware
})

// Валидация в зависимости от типа
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

// Schema для обновления inspiration
export const UpdateInspirationSchema = z.object({
    userDescription: z.string().max(1000),
})

// Schema для query параметров списка inspirations
export const GetInspirationsQuerySchema = z.object({
    type: InspirationTypeSchema.optional(),
    status: InspirationStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
})

// Schema для создания тега
export const CreateTagSchema = z.object({
    name: z.string().min(1).max(100),
    category: TagCategorySchema,
})

// Schema для обновления тега
export const UpdateTagSchema = z.object({
    name: z.string().min(1).max(100),
})

// Schema для query параметров списка тегов
export const GetTagsQuerySchema = z.object({
    category: TagCategorySchema.optional(),
    sortBy: z.enum(['name', 'usageCount']).default('usageCount'),
    order: z.enum(['asc', 'desc']).default('desc'),
})

// Schema для Main Prompt
export const MainPromptSchema = z.object({
    brandVoice: z.string().optional(),
    coreThemes: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
    contentGoals: z.array(z.string()).optional(),
    avoidTopics: z.array(z.string()).optional(),
    preferredFormats: z.array(z.string()).optional(),
    additionalContext: z.string().optional(),
})

// Schema для обновления Main Prompt (partial)
export const UpdateMainPromptSchema = MainPromptSchema.partial()

// Types
export type CreateInspirationInput = z.infer<typeof CreateInspirationSchema>
export type UpdateInspirationInput = z.infer<typeof UpdateInspirationSchema>
export type GetInspirationsQuery = z.infer<typeof GetInspirationsQuerySchema>
export type CreateTagInput = z.infer<typeof CreateTagSchema>
export type UpdateTagInput = z.infer<typeof UpdateTagSchema>
export type GetTagsQuery = z.infer<typeof GetTagsQuerySchema>
export type MainPromptInput = z.infer<typeof MainPromptSchema>
export type UpdateMainPromptInput = z.infer<typeof UpdateMainPromptSchema>

