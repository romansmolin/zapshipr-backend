import { z } from 'zod'

import type { User } from './user.schema'

export const userResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    googleAuth: z.boolean(),
    avatar: z.string().nullable(),
    createdAt: z.string(),
})

export type UserResponse = z.infer<typeof userResponseSchema>

export const toUserResponse = (user: User): UserResponse => ({
    id: user.id,
    name: user.name,
    email: user.email,
    googleAuth: user.googleAuth,
    avatar: user.avatar ?? null,
    createdAt: user.createdAt.toISOString(),
})
