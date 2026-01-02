"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMqInspirationScheduler = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../redis");
class BullMqInspirationScheduler {
    constructor() {
        this.queue = new bullmq_1.Queue('inspirations:process', {
            connection: redis_1.redisConnection,
        });
    }
    async scheduleInspiration(inspirationId, workspaceId, userId) {
        await this.queue.add('process-inspiration', {
            inspirationId,
            workspaceId,
            userId,
        }, {
            attempts: 3, // Максимум 3 попытки
            backoff: {
                type: 'exponential',
                delay: 2000, // Начальная задержка 2 секунды
            },
            removeOnComplete: {
                age: 24 * 3600, // Удалять успешные задачи через 24 часа
                count: 1000, // Хранить максимум 1000 успешных задач
            },
            removeOnFail: {
                age: 7 * 24 * 3600, // Удалять неудачные задачи через 7 дней
            },
        });
    }
}
exports.BullMqInspirationScheduler = BullMqInspirationScheduler;
