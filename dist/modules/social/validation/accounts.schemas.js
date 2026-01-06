"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialAccountIdParamSchema = exports.accountIdParamSchema = exports.blueskyConnectSchema = exports.oauthStateRequestSchema = exports.oauthCallbackSchema = void 0;
const zod_1 = require("zod");
const social_account_dto_1 = require("@/modules/social/entity/social-account.dto");
exports.oauthCallbackSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, { message: 'Authorization code is required' }).optional(),
    state: zod_1.z.string().optional(),
    error: zod_1.z.string().optional(),
    error_description: zod_1.z.string().optional(),
    code_verifier: zod_1.z.string().optional(),
});
exports.oauthStateRequestSchema = zod_1.z.object({
    platform: social_account_dto_1.socialPlatformSchema,
    codeVerifier: zod_1.z.string().min(1).optional(),
});
exports.blueskyConnectSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, { message: 'Identifier is required' }),
    appPassword: zod_1.z.string().min(1, { message: 'App password is required' }),
});
exports.accountIdParamSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid(),
});
exports.socialAccountIdParamSchema = zod_1.z.object({
    socialAccountId: zod_1.z.string().uuid(),
});
