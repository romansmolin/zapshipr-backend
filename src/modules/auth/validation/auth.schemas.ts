import { z } from 'zod'

export const signUpSchema = z.object({
    name: z.string({ error: 'Name is required' }).min(1, { message: 'Name is required' }),
    email: z.string({ error: 'Email is required' }).email({ message: 'Email must be valid' }),
    password: z
        .string({ error: 'Password is required' })
        .min(8, { message: 'Password must be at least 8 characters' }),
})

export const signInSchema = z.object({
    email: z.string({ error: 'Email is required' }).email({ message: 'Email must be valid' }),
    password: z
        .string({ error: 'Password is required' })
        .min(8, { message: 'Password must be at least 8 characters' }),
})

export const googleCallbackSchema = z.object({
    code: z.preprocess(
        (value) => (Array.isArray(value) ? value[0] : value),
        z.string({ error: 'Google authorization code is required' }).min(1, {
            message: 'Google authorization code is required',
        })
    ),
})
