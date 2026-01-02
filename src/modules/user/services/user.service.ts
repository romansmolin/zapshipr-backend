import type { IUserRepository } from '../repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IUserService, UsageQuota, UserPlanSnapshot } from './user.service.interface'

export class UserService implements IUserService {
    private readonly userRepository: IUserRepository
    private readonly logger: ILogger

    constructor(userRepository: IUserRepository, logger: ILogger) {
        this.userRepository = userRepository
        this.logger = logger
    }

    async getUserInfo(userId: string) {
        const user = await this.userRepository.findById(userId)

        if (!user) {
            this.logger.warn('User not found', {
                operation: 'UserService.getUserInfo',
                userId,
            })
            throw new AppError({
                errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
                httpCode: 404,
            })
        }

        this.logger.info('User info retrieved', {
            operation: 'UserService.getUserInfo',
            userId,
        })

        return {
            user,
            planName: null, // TODO: Implement plan logic
        }
    }

    async getUsageQuota(userId: string): Promise<UsageQuota> {
        // TODO: Implement usage quota logic
        throw new Error('Not implemented')
    }

    async incrementConnectedAccountsUsage(userId: string): Promise<void> {
        // TODO: Implement increment logic
        throw new Error('Not implemented')
    }

    async decrementConnectedAccountsUsage(userId: string): Promise<void> {
        // TODO: Implement decrement logic
        throw new Error('Not implemented')
    }

    async getUserPlan(userId: string): Promise<UserPlanSnapshot | null> {
        // TODO: Implement get user plan logic
        throw new Error('Not implemented')
    }

    async incrementAiUsage(userId: string): Promise<void> {
        // TODO: Implement increment AI usage logic
        throw new Error('Not implemented')
    }
}
