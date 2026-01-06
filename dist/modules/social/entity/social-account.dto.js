"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAccountResponse = exports.accountRequestSchema = exports.accountSchema = exports.socialPlatformSchema = void 0;
const zod_1 = require("zod");
const social_account_schema_1 = require("./social-account.schema");
exports.socialPlatformSchema = zod_1.z.enum(social_account_schema_1.socialPlatforms);
exports.accountSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    platform: exports.socialPlatformSchema,
    username: zod_1.z.string(),
    picture: zod_1.z.string().nullable(),
    connectedAt: zod_1.z.string().nullable(),
    maxVideoPostDurationSec: zod_1.z.number().int().nullable().optional(),
    privacyLevelOptions: zod_1.z.array(zod_1.z.string()).nullable().optional(),
});
exports.accountRequestSchema = zod_1.z.object({
    platform: exports.socialPlatformSchema,
    pageId: zod_1.z.string().min(1, { message: 'Page ID is required' }),
    username: zod_1.z.string().min(1, { message: 'Username is required' }),
    accessToken: zod_1.z.string().min(1, { message: 'Access token is required' }),
    refreshToken: zod_1.z.string().min(1).nullable().optional(),
    expiresIn: zod_1.z.coerce.date().nullable().optional(),
    refreshExpiresIn: zod_1.z.coerce.date().nullable().optional(),
});
const toAccountResponse = (account) => ({
    id: account.id,
    userId: account.userId,
    platform: account.platform,
    username: account.username,
    picture: account.picture ?? null,
    connectedAt: account.connectedDate ? account.connectedDate.toISOString() : null,
    maxVideoPostDurationSec: account.maxVideoPostDurationSec ?? null,
    privacyLevelOptions: account.privacyLevelOptions ?? null,
});
exports.toAccountResponse = toAccountResponse;
