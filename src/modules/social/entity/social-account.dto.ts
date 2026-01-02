import { z } from 'zod'

import type { SocialAccount } from './social-account.schema'
import { socialPlatforms } from './social-account.schema'

export const socialPlatformSchema = z.enum(socialPlatforms)

export const accountSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    platform: socialPlatformSchema,
    username: z.string(),
    picture: z.string().nullable(),
    connectedAt: z.string().nullable(),
    maxVideoPostDurationSec: z.number().int().nullable().optional(),
    privacyLevelOptions: z.array(z.string()).nullable().optional(),
})

export type SocialAccountResponse = z.infer<typeof accountSchema>

export const accountRequestSchema = z.object({
    platform: socialPlatformSchema,
    pageId: z.string().min(1, { message: 'Page ID is required' }),
    username: z.string().min(1, { message: 'Username is required' }),
    accessToken: z.string().min(1, { message: 'Access token is required' }),
    refreshToken: z.string().min(1).nullable().optional(),
    expiresIn: z.coerce.date().nullable().optional(),
    refreshExpiresIn: z.coerce.date().nullable().optional(),
})

export type SocialAccountRequest = z.infer<typeof accountRequestSchema>

export const toAccountResponse = (account: SocialAccount): SocialAccountResponse => ({
    id: account.id,
    userId: account.userId,
    platform: account.platform,
    username: account.username,
    picture: account.picture ?? null,
    connectedAt: account.connectedDate ? account.connectedDate.toISOString() : null,
    maxVideoPostDurationSec: account.maxVideoPostDurationSec ?? null,
    privacyLevelOptions: account.privacyLevelOptions ?? null,
})
