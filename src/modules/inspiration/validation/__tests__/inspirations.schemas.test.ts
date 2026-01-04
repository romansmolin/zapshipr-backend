import { describe, it, expect } from '@jest/globals'
import {
    CreateInspirationSchema,
    UpdateInspirationSchema,
    GetInspirationsQuerySchema,
    CreateTagSchema,
    UpdateTagSchema,
    GetTagsQuerySchema,
    MainPromptSchema,
    UpdateMainPromptSchema,
    validateInspirationByType,
} from '../inspirations.schemas'

describe('Inspirations Validation Schemas', () => {
    describe('CreateInspirationSchema', () => {
        it('should validate correct inspiration data', () => {
            const validData = {
                type: 'text',
                title: 'Test title',
                content: 'This is a test inspiration',
                userDescription: 'Test description',
            }

            const result = CreateInspirationSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        it('should accept valid inspiration types', () => {
            const types = ['image', 'link', 'text', 'document']

            types.forEach((type) => {
                const result = CreateInspirationSchema.safeParse({ type, title: 'Test title' })
                expect(result.success).toBe(true)
            })
        })

        it('should reject invalid inspiration type', () => {
            const invalidData = {
                type: 'invalid-type',
            }

            const result = CreateInspirationSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })

        it('should reject userDescription exceeding 1000 characters', () => {
            const invalidData = {
                type: 'text',
                title: 'Test title',
                userDescription: 'a'.repeat(1001),
            }

            const result = CreateInspirationSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })

        it('should allow userDescription up to 1000 characters', () => {
            const validData = {
                type: 'text',
                title: 'Test title',
                userDescription: 'a'.repeat(1000),
            }

            const result = CreateInspirationSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })
    })

    describe('validateInspirationByType', () => {
        it('should validate link type requires URL', () => {
            expect(() => {
                validateInspirationByType({ type: 'link', content: undefined })
            }).toThrow('content is required for type=link')
        })

        it('should validate link type with valid URL', () => {
            expect(() => {
                validateInspirationByType({ type: 'link', content: 'https://example.com' })
            }).not.toThrow()
        })

        it('should reject invalid URL for link type', () => {
            expect(() => {
                validateInspirationByType({ type: 'link', content: 'not-a-url' })
            }).toThrow('Invalid URL format')
        })

        it('should validate text type requires content', () => {
            expect(() => {
                validateInspirationByType({ type: 'text', content: undefined })
            }).toThrow('content must be at least 10 characters for type=text')
        })

        it('should validate text type requires minimum 10 characters', () => {
            expect(() => {
                validateInspirationByType({ type: 'text', content: 'short' })
            }).toThrow('content must be at least 10 characters for type=text')
        })

        it('should accept text with 10 or more characters', () => {
            expect(() => {
                validateInspirationByType({ type: 'text', content: 'This is at least 10 characters' })
            }).not.toThrow()
        })
    })

    describe('UpdateInspirationSchema', () => {
        it('should validate update data', () => {
            const validData = {
                userDescription: 'Updated description',
            }

            const result = UpdateInspirationSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        it('should reject userDescription exceeding 1000 characters', () => {
            const invalidData = {
                userDescription: 'a'.repeat(1001),
            }

            const result = UpdateInspirationSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })
    })

    describe('GetInspirationsQuerySchema', () => {
        it('should parse query parameters with defaults', () => {
            const result = GetInspirationsQuerySchema.parse({})

            expect(result).toEqual({
                limit: 20,
                offset: 0,
            })
        })

        it('should parse custom query parameters', () => {
            const result = GetInspirationsQuerySchema.parse({
                type: 'link',
                status: 'completed',
                limit: '50',
                offset: '10',
            })

            expect(result).toEqual({
                type: 'link',
                status: 'completed',
                limit: 50,
                offset: 10,
            })
        })

        it('should enforce maximum limit of 100', () => {
            const result = GetInspirationsQuerySchema.safeParse({
                limit: '150',
            })

            expect(result.success).toBe(false)
        })

        it('should enforce minimum limit of 1', () => {
            const result = GetInspirationsQuerySchema.safeParse({
                limit: '0',
            })

            expect(result.success).toBe(false)
        })

        it('should enforce minimum offset of 0', () => {
            const result = GetInspirationsQuerySchema.safeParse({
                offset: '-1',
            })

            expect(result.success).toBe(false)
        })
    })

    describe('CreateTagSchema', () => {
        it('should validate tag creation', () => {
            const validData = {
                name: 'marketing',
                category: 'topic',
            }

            const result = CreateTagSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        it('should accept valid tag categories', () => {
            const categories = ['topic', 'format', 'tone', 'style', 'other']

            categories.forEach((category) => {
                const result = CreateTagSchema.safeParse({ name: 'test', category })
                expect(result.success).toBe(true)
            })
        })

        it('should reject invalid category', () => {
            const invalidData = {
                name: 'test',
                category: 'invalid',
            }

            const result = CreateTagSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })

        it('should reject name exceeding 100 characters', () => {
            const invalidData = {
                name: 'a'.repeat(101),
                category: 'topic',
            }

            const result = CreateTagSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })

        it('should reject empty name', () => {
            const invalidData = {
                name: '',
                category: 'topic',
            }

            const result = CreateTagSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })
    })

    describe('UpdateTagSchema', () => {
        it('should validate tag update', () => {
            const validData = {
                name: 'updated-name',
            }

            const result = UpdateTagSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })
    })

    describe('GetTagsQuerySchema', () => {
        it('should parse query with defaults', () => {
            const result = GetTagsQuerySchema.parse({})

            expect(result).toEqual({
                sortBy: 'usageCount',
                order: 'desc',
            })
        })

        it('should parse custom query parameters', () => {
            const result = GetTagsQuerySchema.parse({
                category: 'topic',
                sortBy: 'name',
                order: 'asc',
            })

            expect(result).toEqual({
                category: 'topic',
                sortBy: 'name',
                order: 'asc',
            })
        })

        it('should accept valid sort by values', () => {
            const sortByValues = ['name', 'usageCount']

            sortByValues.forEach((sortBy) => {
                const result = GetTagsQuerySchema.safeParse({ sortBy })
                expect(result.success).toBe(true)
            })
        })

        it('should accept valid order values', () => {
            const orderValues = ['asc', 'desc']

            orderValues.forEach((order) => {
                const result = GetTagsQuerySchema.safeParse({ order })
                expect(result.success).toBe(true)
            })
        })
    })

    describe('MainPromptSchema', () => {
        it('should validate complete main prompt', () => {
            const validData = {
                brandVoice: 'Professional and friendly',
                coreThemes: ['marketing', 'growth'],
                targetAudience: 'B2B marketers',
                contentGoals: ['educate', 'inspire'],
                avoidTopics: ['politics'],
                preferredFormats: ['carousel', 'video'],
                additionalContext: 'Focus on data-driven insights',
            }

            const result = MainPromptSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        it('should allow empty main prompt', () => {
            const result = MainPromptSchema.safeParse({})
            expect(result.success).toBe(true)
        })

        it('should validate arrays in main prompt', () => {
            const validData = {
                coreThemes: ['theme1', 'theme2', 'theme3'],
                contentGoals: ['goal1', 'goal2'],
            }

            const result = MainPromptSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })
    })

    describe('UpdateMainPromptSchema', () => {
        it('should validate partial main prompt update', () => {
            const validData = {
                brandVoice: 'Updated voice',
            }

            const result = UpdateMainPromptSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        it('should allow updating only specific fields', () => {
            const validData = {
                coreThemes: ['new-theme'],
                targetAudience: 'New audience',
            }

            const result = UpdateMainPromptSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        it('should allow empty update', () => {
            const result = UpdateMainPromptSchema.safeParse({})
            expect(result.success).toBe(true)
        })
    })
})
