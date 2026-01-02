"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMainPromptSchema = exports.MainPromptSchema = exports.GetTagsQuerySchema = exports.UpdateTagSchema = exports.CreateTagSchema = exports.GetInspirationsQuerySchema = exports.UpdateInspirationSchema = exports.validateInspirationByType = exports.CreateInspirationSchema = exports.TagCategorySchema = exports.InspirationStatusSchema = exports.InspirationTypeSchema = void 0;
const zod_1 = require("zod");
// Enum для типов вдохновений
exports.InspirationTypeSchema = zod_1.z.enum(['image', 'link', 'text', 'document']);
// Enum для статусов
exports.InspirationStatusSchema = zod_1.z.enum(['processing', 'completed', 'failed']);
// Enum для категорий тегов
exports.TagCategorySchema = zod_1.z.enum(['topic', 'format', 'tone', 'style', 'other']);
// Schema для создания inspiration
exports.CreateInspirationSchema = zod_1.z.object({
    type: exports.InspirationTypeSchema,
    content: zod_1.z.string().optional(), // URL или текст
    userDescription: zod_1.z.string().max(1000).optional(),
    // file будет обрабатываться через multer middleware
});
// Валидация в зависимости от типа
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
    }
    if (data.type === 'text') {
        if (!data.content || data.content.length < 10) {
            throw new Error('content must be at least 10 characters for type=text');
        }
    }
};
exports.validateInspirationByType = validateInspirationByType;
// Schema для обновления inspiration
exports.UpdateInspirationSchema = zod_1.z.object({
    userDescription: zod_1.z.string().max(1000),
});
// Schema для query параметров списка inspirations
exports.GetInspirationsQuerySchema = zod_1.z.object({
    type: exports.InspirationTypeSchema.optional(),
    status: exports.InspirationStatusSchema.optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
// Schema для создания тега
exports.CreateTagSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: exports.TagCategorySchema,
});
// Schema для обновления тега
exports.UpdateTagSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
});
// Schema для query параметров списка тегов
exports.GetTagsQuerySchema = zod_1.z.object({
    category: exports.TagCategorySchema.optional(),
    sortBy: zod_1.z.enum(['name', 'usageCount']).default('usageCount'),
    order: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
// Schema для Main Prompt
exports.MainPromptSchema = zod_1.z.object({
    brandVoice: zod_1.z.string().optional(),
    coreThemes: zod_1.z.array(zod_1.z.string()).optional(),
    targetAudience: zod_1.z.string().optional(),
    contentGoals: zod_1.z.array(zod_1.z.string()).optional(),
    avoidTopics: zod_1.z.array(zod_1.z.string()).optional(),
    preferredFormats: zod_1.z.array(zod_1.z.string()).optional(),
    additionalContext: zod_1.z.string().optional(),
});
// Schema для обновления Main Prompt (partial)
exports.UpdateMainPromptSchema = exports.MainPromptSchema.partial();
