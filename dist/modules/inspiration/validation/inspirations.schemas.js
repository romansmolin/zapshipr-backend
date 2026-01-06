"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMainPromptSchema = exports.MainPromptSchema = exports.GetTagsQuerySchema = exports.UpdateTagSchema = exports.CreateTagSchema = exports.GetInspirationsQuerySchema = exports.UpdateInspirationSchema = exports.validateInspirationByType = exports.CreateInspirationSchema = exports.TagCategorySchema = exports.InspirationStatusSchema = exports.InspirationTypeSchema = void 0;
const zod_1 = require("zod");
exports.InspirationTypeSchema = zod_1.z.enum(['image', 'link', 'text', 'document']);
exports.InspirationStatusSchema = zod_1.z.enum(['processing', 'completed', 'failed']);
exports.TagCategorySchema = zod_1.z.enum(['topic', 'format', 'tone', 'style', 'other']);
exports.CreateInspirationSchema = zod_1.z.object({
    type: exports.InspirationTypeSchema,
    title: zod_1.z.string().min(1).max(100),
    content: zod_1.z.string().optional(),
    userDescription: zod_1.z.string().max(1000).optional(),
});
const validateInspirationByType = (data) => {
    if (data.type === 'link') {
        if (!data.content) {
            throw new Error('content is required for type=link');
        }
        // Проверка валидности URL
        try {
            new URL(data.content);
        }
        catch {
            throw new Error('Invalid URL format');
        }
        const url = data.content;
        if (/tiktok\.com\//i.test(url)) {
            throw new Error('TikTok links are not supported yet');
        }
        if (/instagram\.com\/reel\//i.test(url)) {
            throw new Error('Instagram Reels links are not supported yet');
        }
    }
    if (data.type === 'text') {
        if (!data.content || data.content.length < 10) {
            throw new Error('content must be at least 10 characters for type=text');
        }
    }
};
exports.validateInspirationByType = validateInspirationByType;
exports.UpdateInspirationSchema = zod_1.z.object({
    userDescription: zod_1.z.string().max(1000),
});
exports.GetInspirationsQuerySchema = zod_1.z.object({
    type: exports.InspirationTypeSchema.optional(),
    status: exports.InspirationStatusSchema.optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
exports.CreateTagSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: exports.TagCategorySchema,
});
exports.UpdateTagSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
});
exports.GetTagsQuerySchema = zod_1.z.object({
    category: exports.TagCategorySchema.optional(),
    sortBy: zod_1.z.enum(['name', 'usageCount']).default('usageCount'),
    order: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.MainPromptSchema = zod_1.z.object({
    brandVoice: zod_1.z.string().optional(),
    coreThemes: zod_1.z.array(zod_1.z.string()).optional(),
    targetAudience: zod_1.z.string().optional(),
    contentGoals: zod_1.z.array(zod_1.z.string()).optional(),
    avoidTopics: zod_1.z.array(zod_1.z.string()).optional(),
    preferredFormats: zod_1.z.array(zod_1.z.string()).optional(),
    additionalContext: zod_1.z.string().optional(),
});
exports.UpdateMainPromptSchema = exports.MainPromptSchema.partial();
