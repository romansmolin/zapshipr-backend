import { z } from 'zod'

export const listUserImagesQuerySchema = z.object({
    limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 50))
        .pipe(z.number().int().min(1).max(100)),
    cursor: z.string().optional(),
    prefix: z.string().optional(),
    signed: z
        .string()
        .optional()
        .transform((val) => val === 'true')
        .pipe(z.boolean()),
    expiresIn: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 3600))
        .pipe(z.number().int().min(60).max(86400)),
})

export type ListUserImagesQuery = z.infer<typeof listUserImagesQuerySchema>
