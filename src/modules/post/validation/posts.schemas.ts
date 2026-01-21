import { z } from 'zod'

import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { PostStatus, TikTokPrivacyLevel } from '@/modules/post/types/posts.types'
import { isValidTimeZone, parseDateWithTimeZone } from '@/shared/utils/timezone'

const timezoneSchema = z
    .string()
    .min(1)
    .refine((value) => isValidTimeZone(value), { message: 'Invalid timezone' })

const postTargetSchema = z.object({
    account: z.string(),
    platform: z.nativeEnum(SocilaMediaPlatform),
    text: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    links: z.array(z.string()).nullable().optional(),
    threadsReplies: z.array(z.string()).nullable().optional(),
    pinterestBoardId: z.string().nullable().optional(),
    tikTokPostPrivacyLevel: z.nativeEnum(TikTokPrivacyLevel).nullable().optional(),
    isAutoMusicEnabled: z.boolean().nullable().optional(),
    instagramLocationId: z.string().nullable().optional(),
    instagramFacebookPageId: z.string().nullable().optional(),
})

export const createPostsSchema = z.object({
    postType: z.enum(['text', 'media']),
    postStatus: z.nativeEnum(PostStatus),
    posts: z.array(postTargetSchema),
    postNow: z.boolean().optional(),
    scheduledAtLocal: z.string().min(1).nullable().optional(),
    timezone: timezoneSchema.nullable().optional(),
    mainCaption: z.string().nullable().optional(),
    coverTimestamp: z.number().nullable().optional(),
    copyDataUrls: z.array(z.string()).nullable().optional(),
}).superRefine((value, ctx) => {
    if (value.scheduledAtLocal) {
        if (!value.timezone) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Timezone is required when scheduledAtLocal is provided',
                path: ['timezone'],
            })
            return
        }

        const scheduledTime = parseDateWithTimeZone(value.scheduledAtLocal, value.timezone)
        if (!scheduledTime || Number.isNaN(scheduledTime.getTime())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'scheduledAtLocal must be a valid date/time',
                path: ['scheduledAtLocal'],
            })
        }
    }
})
