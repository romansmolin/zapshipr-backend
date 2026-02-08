import type { ILogger } from '@/shared/logger/logger.interface'

export class LogoutUseCase {
    constructor(private readonly logger: ILogger) {}

    async execute(): Promise<void> {
        this.logger.info('User logged out', { operation: 'LogoutUseCase.execute' })
    }
}
