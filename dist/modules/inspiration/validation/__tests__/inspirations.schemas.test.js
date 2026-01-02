"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const inspirations_schemas_1 = require("../inspirations.schemas");
(0, globals_1.describe)('Inspirations Validation Schemas', () => {
    (0, globals_1.describe)('CreateInspirationSchema', () => {
        (0, globals_1.it)('should validate correct inspiration data', () => {
            const validData = {
                type: 'text',
                content: 'This is a test inspiration',
                userDescription: 'Test description',
            };
            const result = inspirations_schemas_1.CreateInspirationSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
        (0, globals_1.it)('should accept valid inspiration types', () => {
            const types = ['image', 'link', 'text', 'document'];
            types.forEach((type) => {
                const result = inspirations_schemas_1.CreateInspirationSchema.safeParse({ type });
                (0, globals_1.expect)(result.success).toBe(true);
            });
        });
        (0, globals_1.it)('should reject invalid inspiration type', () => {
            const invalidData = {
                type: 'invalid-type',
            };
            const result = inspirations_schemas_1.CreateInspirationSchema.safeParse(invalidData);
            (0, globals_1.expect)(result.success).toBe(false);
        });
        (0, globals_1.it)('should reject userDescription exceeding 1000 characters', () => {
            const invalidData = {
                type: 'text',
                userDescription: 'a'.repeat(1001),
            };
            const result = inspirations_schemas_1.CreateInspirationSchema.safeParse(invalidData);
            (0, globals_1.expect)(result.success).toBe(false);
        });
        (0, globals_1.it)('should allow userDescription up to 1000 characters', () => {
            const validData = {
                type: 'text',
                userDescription: 'a'.repeat(1000),
            };
            const result = inspirations_schemas_1.CreateInspirationSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
    });
    (0, globals_1.describe)('validateInspirationByType', () => {
        (0, globals_1.it)('should validate link type requires URL', () => {
            (0, globals_1.expect)(() => {
                (0, inspirations_schemas_1.validateInspirationByType)({ type: 'link', content: undefined });
            }).toThrow('content is required for type=link');
        });
        (0, globals_1.it)('should validate link type with valid URL', () => {
            (0, globals_1.expect)(() => {
                (0, inspirations_schemas_1.validateInspirationByType)({ type: 'link', content: 'https://example.com' });
            }).not.toThrow();
        });
        (0, globals_1.it)('should reject invalid URL for link type', () => {
            (0, globals_1.expect)(() => {
                (0, inspirations_schemas_1.validateInspirationByType)({ type: 'link', content: 'not-a-url' });
            }).toThrow('Invalid URL format');
        });
        (0, globals_1.it)('should validate text type requires content', () => {
            (0, globals_1.expect)(() => {
                (0, inspirations_schemas_1.validateInspirationByType)({ type: 'text', content: undefined });
            }).toThrow('content must be at least 10 characters for type=text');
        });
        (0, globals_1.it)('should validate text type requires minimum 10 characters', () => {
            (0, globals_1.expect)(() => {
                (0, inspirations_schemas_1.validateInspirationByType)({ type: 'text', content: 'short' });
            }).toThrow('content must be at least 10 characters for type=text');
        });
        (0, globals_1.it)('should accept text with 10 or more characters', () => {
            (0, globals_1.expect)(() => {
                (0, inspirations_schemas_1.validateInspirationByType)({ type: 'text', content: 'This is at least 10 characters' });
            }).not.toThrow();
        });
    });
    (0, globals_1.describe)('UpdateInspirationSchema', () => {
        (0, globals_1.it)('should validate update data', () => {
            const validData = {
                userDescription: 'Updated description',
            };
            const result = inspirations_schemas_1.UpdateInspirationSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
        (0, globals_1.it)('should reject userDescription exceeding 1000 characters', () => {
            const invalidData = {
                userDescription: 'a'.repeat(1001),
            };
            const result = inspirations_schemas_1.UpdateInspirationSchema.safeParse(invalidData);
            (0, globals_1.expect)(result.success).toBe(false);
        });
    });
    (0, globals_1.describe)('GetInspirationsQuerySchema', () => {
        (0, globals_1.it)('should parse query parameters with defaults', () => {
            const result = inspirations_schemas_1.GetInspirationsQuerySchema.parse({});
            (0, globals_1.expect)(result).toEqual({
                limit: 20,
                offset: 0,
            });
        });
        (0, globals_1.it)('should parse custom query parameters', () => {
            const result = inspirations_schemas_1.GetInspirationsQuerySchema.parse({
                type: 'link',
                status: 'completed',
                limit: '50',
                offset: '10',
            });
            (0, globals_1.expect)(result).toEqual({
                type: 'link',
                status: 'completed',
                limit: 50,
                offset: 10,
            });
        });
        (0, globals_1.it)('should enforce maximum limit of 100', () => {
            const result = inspirations_schemas_1.GetInspirationsQuerySchema.safeParse({
                limit: '150',
            });
            (0, globals_1.expect)(result.success).toBe(false);
        });
        (0, globals_1.it)('should enforce minimum limit of 1', () => {
            const result = inspirations_schemas_1.GetInspirationsQuerySchema.safeParse({
                limit: '0',
            });
            (0, globals_1.expect)(result.success).toBe(false);
        });
        (0, globals_1.it)('should enforce minimum offset of 0', () => {
            const result = inspirations_schemas_1.GetInspirationsQuerySchema.safeParse({
                offset: '-1',
            });
            (0, globals_1.expect)(result.success).toBe(false);
        });
    });
    (0, globals_1.describe)('CreateTagSchema', () => {
        (0, globals_1.it)('should validate tag creation', () => {
            const validData = {
                name: 'marketing',
                category: 'topic',
            };
            const result = inspirations_schemas_1.CreateTagSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
        (0, globals_1.it)('should accept valid tag categories', () => {
            const categories = ['topic', 'format', 'tone', 'style', 'other'];
            categories.forEach((category) => {
                const result = inspirations_schemas_1.CreateTagSchema.safeParse({ name: 'test', category });
                (0, globals_1.expect)(result.success).toBe(true);
            });
        });
        (0, globals_1.it)('should reject invalid category', () => {
            const invalidData = {
                name: 'test',
                category: 'invalid',
            };
            const result = inspirations_schemas_1.CreateTagSchema.safeParse(invalidData);
            (0, globals_1.expect)(result.success).toBe(false);
        });
        (0, globals_1.it)('should reject name exceeding 100 characters', () => {
            const invalidData = {
                name: 'a'.repeat(101),
                category: 'topic',
            };
            const result = inspirations_schemas_1.CreateTagSchema.safeParse(invalidData);
            (0, globals_1.expect)(result.success).toBe(false);
        });
        (0, globals_1.it)('should reject empty name', () => {
            const invalidData = {
                name: '',
                category: 'topic',
            };
            const result = inspirations_schemas_1.CreateTagSchema.safeParse(invalidData);
            (0, globals_1.expect)(result.success).toBe(false);
        });
    });
    (0, globals_1.describe)('UpdateTagSchema', () => {
        (0, globals_1.it)('should validate tag update', () => {
            const validData = {
                name: 'updated-name',
            };
            const result = inspirations_schemas_1.UpdateTagSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
    });
    (0, globals_1.describe)('GetTagsQuerySchema', () => {
        (0, globals_1.it)('should parse query with defaults', () => {
            const result = inspirations_schemas_1.GetTagsQuerySchema.parse({});
            (0, globals_1.expect)(result).toEqual({
                sortBy: 'usageCount',
                order: 'desc',
            });
        });
        (0, globals_1.it)('should parse custom query parameters', () => {
            const result = inspirations_schemas_1.GetTagsQuerySchema.parse({
                category: 'topic',
                sortBy: 'name',
                order: 'asc',
            });
            (0, globals_1.expect)(result).toEqual({
                category: 'topic',
                sortBy: 'name',
                order: 'asc',
            });
        });
        (0, globals_1.it)('should accept valid sort by values', () => {
            const sortByValues = ['name', 'usageCount'];
            sortByValues.forEach((sortBy) => {
                const result = inspirations_schemas_1.GetTagsQuerySchema.safeParse({ sortBy });
                (0, globals_1.expect)(result.success).toBe(true);
            });
        });
        (0, globals_1.it)('should accept valid order values', () => {
            const orderValues = ['asc', 'desc'];
            orderValues.forEach((order) => {
                const result = inspirations_schemas_1.GetTagsQuerySchema.safeParse({ order });
                (0, globals_1.expect)(result.success).toBe(true);
            });
        });
    });
    (0, globals_1.describe)('MainPromptSchema', () => {
        (0, globals_1.it)('should validate complete main prompt', () => {
            const validData = {
                brandVoice: 'Professional and friendly',
                coreThemes: ['marketing', 'growth'],
                targetAudience: 'B2B marketers',
                contentGoals: ['educate', 'inspire'],
                avoidTopics: ['politics'],
                preferredFormats: ['carousel', 'video'],
                additionalContext: 'Focus on data-driven insights',
            };
            const result = inspirations_schemas_1.MainPromptSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
        (0, globals_1.it)('should allow empty main prompt', () => {
            const result = inspirations_schemas_1.MainPromptSchema.safeParse({});
            (0, globals_1.expect)(result.success).toBe(true);
        });
        (0, globals_1.it)('should validate arrays in main prompt', () => {
            const validData = {
                coreThemes: ['theme1', 'theme2', 'theme3'],
                contentGoals: ['goal1', 'goal2'],
            };
            const result = inspirations_schemas_1.MainPromptSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
    });
    (0, globals_1.describe)('UpdateMainPromptSchema', () => {
        (0, globals_1.it)('should validate partial main prompt update', () => {
            const validData = {
                brandVoice: 'Updated voice',
            };
            const result = inspirations_schemas_1.UpdateMainPromptSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
        (0, globals_1.it)('should allow updating only specific fields', () => {
            const validData = {
                coreThemes: ['new-theme'],
                targetAudience: 'New audience',
            };
            const result = inspirations_schemas_1.UpdateMainPromptSchema.safeParse(validData);
            (0, globals_1.expect)(result.success).toBe(true);
        });
        (0, globals_1.it)('should allow empty update', () => {
            const result = inspirations_schemas_1.UpdateMainPromptSchema.safeParse({});
            (0, globals_1.expect)(result.success).toBe(true);
        });
    });
});
