import { z } from 'zod'

// Tag category enum
export const TagCategoryEnum = z.enum(['topic', 'format', 'tone', 'style', 'other'])

// Create tag schema
export const createTagSchema = z.object({
    name: z.string().min(1).max(50),
    category: TagCategoryEnum,
})

// Update tag schema
export const updateTagSchema = z.object({
    name: z.string().min(1).max(50),
})

// Get tags query schema
export const getTagsQuerySchema = z.object({
    category: TagCategoryEnum.optional(),
    sortBy: z.enum(['name', 'usageCount']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
})

// Param schemas
export const tagIdParamSchema = z.object({
    tagId: z.string().uuid(),
})

// Type exports
export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
export type GetTagsQuery = z.infer<typeof getTagsQuerySchema>
export type TagCategory = z.infer<typeof TagCategoryEnum>
