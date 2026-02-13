import { describe, expect, it } from '@jest/globals'

import { PostStatus } from '@/modules/post/types/posts.types'
import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'

import { createPostsSchema } from './posts.schemas'

const createBasePayload = () => ({
    postType: 'media' as const,
    postStatus: PostStatus.DRAFT,
    posts: [
        {
            account: 'account-1',
            platform: SocilaMediaPlatform.INSTAGRAM,
        },
    ],
})

const createValidTransform = () => ({
    mediaIndex: 0,
    platform: SocilaMediaPlatform.INSTAGRAM,
    ratio: '4:5',
    crop: {
        x: 0,
        y: 0.8535370879120879,
        scale: 1,
    },
    source: {
        width: 1024,
        height: 1536,
    },
    version: 1 as const,
})

describe('createPostsSchema mediaTransforms', () => {
    it('accepts valid mediaTransforms payload', () => {
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [createValidTransform()],
        })

        expect(result.success).toBe(true)
    })

    it('accepts mediaTransforms without platform', () => {
        const transform = createValidTransform()
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [{ ...transform, platform: undefined }],
        })

        expect(result.success).toBe(true)
    })

    it('accepts ratio "original"', () => {
        const transform = createValidTransform()
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [{ ...transform, ratio: 'original' }],
        })

        expect(result.success).toBe(true)
    })

    it('rejects invalid ratio format', () => {
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [{ ...createValidTransform(), ratio: '4x5' }],
        })

        expect(result.success).toBe(false)
    })

    it('rejects crop.x outside range [0, 1]', () => {
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [{ ...createValidTransform(), crop: { ...createValidTransform().crop, x: 1.1 } }],
        })

        expect(result.success).toBe(false)
    })

    it('accepts crop.x and crop.y in range [-1, 1]', () => {
        const transform = createValidTransform()
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [{ ...transform, crop: { ...transform.crop, x: -1, y: 1 } }],
        })

        expect(result.success).toBe(true)
    })

    it('rejects crop.scale less than or equal to zero', () => {
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [{ ...createValidTransform(), crop: { ...createValidTransform().crop, scale: 0 } }],
        })

        expect(result.success).toBe(false)
    })

    it('rejects duplicate mediaIndex in mediaTransforms', () => {
        const transform = createValidTransform()
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            mediaTransforms: [transform, { ...transform }],
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.message === 'Duplicate mediaIndex in mediaTransforms')).toBe(
                true
            )
        }
    })

    it('rejects mediaTransforms for text posts', () => {
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            postType: 'text' as const,
            mediaTransforms: [createValidTransform()],
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(
                result.error.issues.some((issue) => issue.message === 'mediaTransforms are only allowed for media posts')
            ).toBe(true)
        }
    })

    it('rejects duplicate mediaIndices values within the same target', () => {
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            posts: [
                {
                    account: 'account-1',
                    platform: SocilaMediaPlatform.INSTAGRAM,
                    mediaIndices: [0, 0],
                },
            ],
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.join('.') === 'posts.0.mediaIndices.1')).toBe(true)
        }
    })

    it('rejects empty mediaIndices for media posts when provided', () => {
        const result = createPostsSchema.safeParse({
            ...createBasePayload(),
            posts: [
                {
                    account: 'account-1',
                    platform: SocilaMediaPlatform.INSTAGRAM,
                    mediaIndices: [],
                },
            ],
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.join('.') === 'posts.0.mediaIndices')).toBe(true)
        }
    })
})
