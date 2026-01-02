import { z } from 'zod'

import { socialPlatformSchema } from '@/modules/social/entity/social-account.dto'

export const oauthCallbackSchema = z.object({
    code: z.string().min(1, { message: 'Authorization code is required' }).optional(),
    state: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    code_verifier: z.string().optional(),
})

export const oauthStateRequestSchema = z.object({
    platform: socialPlatformSchema,
    codeVerifier: z.string().min(1).optional(),
})

export const blueskyConnectSchema = z.object({
    identifier: z.string().min(1, { message: 'Identifier is required' }),
    appPassword: z.string().min(1, { message: 'App password is required' }),
})

export const accountIdParamSchema = z.object({
    accountId: z.string().uuid(),
})

export const socialAccountIdParamSchema = z.object({
    socialAccountId: z.string().uuid(),
})
