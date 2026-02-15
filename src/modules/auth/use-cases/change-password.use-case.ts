import bcrypt from 'bcryptjs'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'

import { TokenService } from '../services/token.service'

export interface ResetPasswordInput {
    token: string
    newPassword: string
}

export class ChangePasswordUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: TokenService,
        private readonly logger: ILogger
    ) {}

    async execute(payload: ResetPasswordInput): Promise<void> {
        const { token, newPassword } = payload
        const { userId, email } = this.tokenService.verifyPasswordResetToken(token)
        const user = await this.userRepository.findById(userId)

        if (!user || user.email !== email) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        const passwordHash = await bcrypt.hash(newPassword, 10)
        await this.userRepository.updateUserPassword(user.id, passwordHash)
        await this.userRepository.updateRefreshToken(user.id, null)

        this.logger.info('Password reset successfully', {
            operation: 'ChangePasswordUseCase.execute',
            userId: user.id,
        })
    }
}
