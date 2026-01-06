"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiOutputSchema = exports.AiOutputItemSchema = exports.aiRequestSchema = exports.aiAccountSchema = void 0;
const zod_1 = require("zod");
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
exports.aiAccountSchema = zod_1.z
    .object({
    id: zod_1.z.string().uuid(),
    platform: zod_1.z.nativeEnum(posts_schemas_1.SocilaMediaPlatform),
})
    .passthrough();
exports.aiRequestSchema = zod_1.z.object({
    tone: zod_1.z.string().min(1, { message: 'Tone is required' }),
    language: zod_1.z.string().min(1, { message: 'Language is required' }),
    includeHashtags: zod_1.z.boolean().optional(),
    notesForAi: zod_1.z.string().nullable().optional(),
    forbiddenWords: zod_1.z.array(zod_1.z.string()).optional().nullable(),
    selectedAccounts: zod_1.z.array(exports.aiAccountSchema).min(1, { message: 'Selected accounts are required' }),
});
exports.AiOutputItemSchema = zod_1.z.object({
    platform: zod_1.z.nativeEnum(posts_schemas_1.SocilaMediaPlatform),
    language: zod_1.z.string(),
    title: zod_1.z.string().nullable(),
    text: zod_1.z.string(),
    hashtags: zod_1.z.array(zod_1.z.string()),
    charCounts: zod_1.z.object({
        title: zod_1.z.number().nullable(),
        text: zod_1.z.number(),
    }),
    warnings: zod_1.z.array(zod_1.z.string()),
});
exports.AiOutputSchema = zod_1.z.object({
    items: zod_1.z.array(exports.AiOutputItemSchema),
});
