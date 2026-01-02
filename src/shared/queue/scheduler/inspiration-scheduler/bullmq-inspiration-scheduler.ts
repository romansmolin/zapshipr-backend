import { Queue } from 'bullmq'
import { redisConnection } from '../redis'
import type { IInspirationScheduler } from './inspiration-scheduler.interface'
import type { InspirationJobData } from '../../worker/inspiration-worker/inspiration-worker.interface'

export class BullMqInspirationScheduler implements IInspirationScheduler {
    private queue: Queue<InspirationJobData>

    constructor() {
        this.queue = new Queue<InspirationJobData>('inspirations-process', {
            connection: redisConnection,
        })
    }

    async scheduleInspiration(inspirationId: string, workspaceId: string, userId: string): Promise<void> {
        await this.queue.add(
            'process-inspiration',
            {
                inspirationId,
                workspaceId,
                userId,
            },
            {
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
            }
        )
    }
}
