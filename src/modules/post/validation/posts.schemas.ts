import { z } from 'zod'

import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { PostStatus, TikTokPrivacyLevel } from '@/modules/post/types/posts.types'
import { hasTimeZoneInfo, isValidTimeZone, parseDateWithTimeZone } from '@/shared/utils/timezone'

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
    mediaIndices: z.array(z.number().int().min(0)).nullable().optional(),
})

const ratioSchema = z
    .string()
    .regex(/^\d+:\d+$/, { message: 'ratio must be in format "width:height"' })
    .refine((ratio) => {
        const [width, height] = ratio.split(':').map(Number)
        return width > 0 && height > 0
    }, { message: 'ratio values must be greater than zero' })

const mediaTransformSchema = z.object({
    mediaIndex: z.number().int().min(0),
    platform: z.nativeEnum(SocilaMediaPlatform),
    ratio: ratioSchema,
    crop: z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        scale: z.number().positive(),
    }),
    source: z.object({
        width: z.number().positive(),
        height: z.number().positive(),
    }),
    version: z.literal(1),
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
    mediaTransforms: z.array(mediaTransformSchema).nullable().optional(),
}).superRefine((value, ctx) => {
    for (const [targetIndex, target] of value.posts.entries()) {
        if (!target.mediaIndices) {
            continue
        }

        if (value.postType === 'media' && target.mediaIndices.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'mediaIndices must not be empty for media posts',
                path: ['posts', targetIndex, 'mediaIndices'],
            })
        }

        const seen = new Set<number>()
        for (const [mediaIndexIndex, mediaIndex] of target.mediaIndices.entries()) {
            if (seen.has(mediaIndex)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'mediaIndices values must be unique',
                    path: ['posts', targetIndex, 'mediaIndices', mediaIndexIndex],
                })
            }

            seen.add(mediaIndex)
        }
    }

    if (value.scheduledAtLocal) {
        if (!value.timezone) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Timezone is required when scheduledAtLocal is provided',
                path: ['timezone'],
            })
            return
        }

        if (hasTimeZoneInfo(value.scheduledAtLocal)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'scheduledAtLocal must not include timezone information',
                path: ['scheduledAtLocal'],
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

    if (value.mediaTransforms && value.mediaTransforms.length > 0) {
        if (value.postType !== 'media') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'mediaTransforms are only allowed for media posts',
                path: ['mediaTransforms'],
            })
        }

        const seen = new Set<number>()
        for (const [index, transform] of value.mediaTransforms.entries()) {
            if (seen.has(transform.mediaIndex)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Duplicate mediaIndex in mediaTransforms',
                    path: ['mediaTransforms', index, 'mediaIndex'],
                })
            }
            seen.add(transform.mediaIndex)
        }
    }
})
