import { z } from 'zod'

export const InspirationTypeSchema = z.enum(['image', 'link', 'text', 'document'])

export const InspirationStatusSchema = z.enum(['processing', 'completed', 'failed'])

export const TagCategorySchema = z.enum(['topic', 'format', 'tone', 'style', 'other'])

// YouTube URL regex patterns
const YOUTUBE_URL_PATTERNS = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/i,
    /^https?:\/\/youtu\.be\/[\w-]+/i,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/i,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/i,
]

const isYouTubeUrl = (url: string): boolean => {
    return YOUTUBE_URL_PATTERNS.some((pattern) => pattern.test(url))
}

export const YouTubeUrlSchema = z
    .string()
    .url('Invalid URL format')
    .refine(isYouTubeUrl, {
        message: 'Only YouTube links are supported (youtube.com/watch, youtu.be, youtube.com/shorts)',
    })

export const CreateInspirationSchema = z
    .object({
        type: InspirationTypeSchema,
        title: z.string().min(1).max(100),
        content: z.string().optional(),
        userDescription: z.string().max(1000).optional(),
    })
    .superRefine((data, ctx) => {
        // Validate YouTube URL for link type
        if (data.type === 'link') {
            if (!data.content) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'content is required for type=link',
                    path: ['content'],
                })
                return
            }

            const result = YouTubeUrlSchema.safeParse(data.content)
            if (!result.success) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: result.error.issues[0]?.message || 'Only YouTube links are supported',
                    path: ['content'],
                })
            }
        }

        // Validate text content
        if (data.type === 'text') {
            if (!data.content || data.content.length < 10) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'content must be at least 10 characters for type=text',
                    path: ['content'],
                })
            }
        }
    })

// Legacy function - kept for backwards compatibility but validation is now in schema
export const validateInspirationByType = (data: { type: string; content?: string }) => {
    if (data.type === 'link') {
        if (!data.content) throw new Error('content is required for type=link')

        if (!isYouTubeUrl(data.content)) {
            throw new Error('Only YouTube links are supported (youtube.com/watch, youtu.be, youtube.com/shorts)')
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
