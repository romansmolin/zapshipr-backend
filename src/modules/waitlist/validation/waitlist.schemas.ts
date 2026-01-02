import { z } from 'zod'

export const joinWaitlistSchema = z.object({
    email: z.string().min(1, { message: 'Email is required' }),
    referralCode: z.string().min(1).optional(),
    referrerWaitlistId: z.string().min(1).optional(),
})
