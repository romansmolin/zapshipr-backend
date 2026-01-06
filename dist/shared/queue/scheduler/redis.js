"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.redisConnection = void 0;
require("dotenv/config");
const ioredis_1 = __importDefault(require("ioredis"));
exports.redisConnection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USER || 'default',
    password: process.env.REDIS_PASSWORD || '',
    maxRetriesPerRequest: null, // важно для BullMQ
};
exports.redis = new ioredis_1.default(exports.redisConnection);
