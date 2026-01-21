import 'dotenv/config'

import Redis, { type RedisOptions } from 'ioredis'

export const redisConnection: RedisOptions = {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USER || 'default',
    password: process.env.REDIS_PASSWORD || '',
    maxRetriesPerRequest: null, // важно для BullMQ
}

export const redis = new Redis(redisConnection)
