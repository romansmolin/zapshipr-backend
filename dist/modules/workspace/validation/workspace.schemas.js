"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMainPromptSchema = exports.mainPromptSchema = exports.updateWorkspaceSchema = exports.createWorkspaceSchema = void 0;
const zod_1 = require("zod");
exports.createWorkspaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: zod_1.z.string().optional(),
});
exports.updateWorkspaceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: zod_1.z.string().optional(),
});
exports.mainPromptSchema = zod_1.z.object({
    brandVoice: zod_1.z.string().optional(),
    coreThemes: zod_1.z.array(zod_1.z.string()).optional(),
    targetAudience: zod_1.z.string().optional(),
    contentGoals: zod_1.z.array(zod_1.z.string()).optional(),
    avoidTopics: zod_1.z.array(zod_1.z.string()).optional(),
    preferredFormats: zod_1.z.array(zod_1.z.string()).optional(),
    additionalContext: zod_1.z.string().optional(),
});
exports.updateMainPromptSchema = zod_1.z.object({
    brandVoice: zod_1.z.string().optional(),
    coreThemes: zod_1.z.array(zod_1.z.string()).optional(),
    targetAudience: zod_1.z.string().optional(),
    contentGoals: zod_1.z.array(zod_1.z.string()).optional(),
    avoidTopics: zod_1.z.array(zod_1.z.string()).optional(),
    preferredFormats: zod_1.z.array(zod_1.z.string()).optional(),
    additionalContext: zod_1.z.string().optional(),
});
