import { z } from 'zod'

const parseBoolean = (value: unknown): unknown => {
    if (typeof value === 'boolean') return value
    if (typeof value !== 'string') return value
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
    return value
}

export const updateUserSettingsSchema = z
    .object({
        name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
        email: z.string().email('Email must be valid').optional(),
        currentPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
        newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
        removeAvatar: z.preprocess(parseBoolean, z.boolean().optional()),
    })
    .refine((data) => !(data.currentPassword && !data.newPassword), {
        message: 'newPassword is required when currentPassword is provided',
        path: ['newPassword'],
    })

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>
