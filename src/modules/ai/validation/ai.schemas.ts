import { z } from 'zod'

import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'

export const aiAccountSchema = z
    .object({
        id: z.string().uuid(),
        platform: z.nativeEnum(SocilaMediaPlatform),
    })
    .passthrough()

export const aiRequestSchema = z.object({
    tone: z.string().min(1, { message: 'Tone is required' }),
    language: z.string().min(1, { message: 'Language is required' }),
    includeHashtags: z.boolean().optional(),
    notesForAi: z.string().nullable().optional(),
    forbiddenWords: z.array(z.string()).optional().nullable(),
    selectedAccounts: z.array(aiAccountSchema).min(1, { message: 'Selected accounts are required' }),
})

export type AiRequest = z.infer<typeof aiRequestSchema>

export const AiOutputItemSchema = z.object({
    platform: z.nativeEnum(SocilaMediaPlatform),
    language: z.string(),
    title: z.string().nullable(),
    text: z.string(),
    hashtags: z.array(z.string()),
    charCounts: z.object({
        title: z.number().nullable(),
        text: z.number(),
    }),
    warnings: z.array(z.string()),
})

export const AiOutputSchema = z.object({
    items: z.array(AiOutputItemSchema),
})

export type AiOutput = z.infer<typeof AiOutputSchema>
