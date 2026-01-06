"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleCallbackSchema = exports.signInSchema = exports.signUpSchema = void 0;
const zod_1 = require("zod");
exports.signUpSchema = zod_1.z.object({
    name: zod_1.z.string({ error: 'Name is required' }).min(1, { message: 'Name is required' }),
    email: zod_1.z.string({ error: 'Email is required' }).email({ message: 'Email must be valid' }),
    password: zod_1.z
        .string({ error: 'Password is required' })
        .min(8, { message: 'Password must be at least 8 characters' }),
});
exports.signInSchema = zod_1.z.object({
    email: zod_1.z.string({ error: 'Email is required' }).email({ message: 'Email must be valid' }),
    password: zod_1.z
        .string({ error: 'Password is required' })
        .min(8, { message: 'Password must be at least 8 characters' }),
});
exports.googleCallbackSchema = zod_1.z.object({
    code: zod_1.z.preprocess((value) => (Array.isArray(value) ? value[0] : value), zod_1.z.string({ error: 'Google authorization code is required' }).min(1, {
        message: 'Google authorization code is required',
    })),
});
