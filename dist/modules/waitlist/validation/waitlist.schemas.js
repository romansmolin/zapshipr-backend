"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinWaitlistSchema = void 0;
const zod_1 = require("zod");
exports.joinWaitlistSchema = zod_1.z.object({
    email: zod_1.z.string().min(1, { message: 'Email is required' }),
    referralCode: zod_1.z.string().min(1).optional(),
    referrerWaitlistId: zod_1.z.string().min(1).optional(),
});
