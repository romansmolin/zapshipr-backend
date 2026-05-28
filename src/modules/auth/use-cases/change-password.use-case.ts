import bcrypt from 'bcryptjs'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'

import type { TokenService } from '../services/token.service'

export interface ResetPasswordInput {
    token: string
    newPassword: string
}

export type ChangePasswordDeps = {
    users: IUserRepository
    tokens: TokenService
    logger: ILogger
}

export const changePassword = async (
    { users, tokens, logger }: ChangePasswordDeps,
    payload: ResetPasswordInput
): Promise<void> => {
    const { token, newPassword } = payload
    const { userId, email } = tokens.verifyPasswordResetToken(token)
    const user = await users.findById(userId)

    if (!user || user.email !== email) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
            httpCode: 401,
        })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await users.updateUserPassword(user.id, passwordHash)
    await users.updateRefreshToken(user.id, null)

    logger.info('Password reset successfully', {
        operation: 'changePassword',
        userId: user.id,
    })
}
