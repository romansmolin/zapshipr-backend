"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUserResponse = exports.userResponseSchema = void 0;
const zod_1 = require("zod");
exports.userResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    email: zod_1.z.string().email(),
    googleAuth: zod_1.z.boolean(),
    avatar: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
const toUserResponse = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    googleAuth: user.googleAuth,
    avatar: user.avatar ?? null,
    createdAt: user.createdAt.toISOString(),
});
exports.toUserResponse = toUserResponse;
