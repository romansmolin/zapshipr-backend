import jwt, { type JwtPayload } from 'jsonwebtoken'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'
import type { User } from '@/modules/user/entity/user.schema'

export class TokenService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly logger: ILogger
    ) {}

    issueRefreshToken(userId: string, email: string): string {
        const secret = process.env.JWT_REFRESH_SECRET ?? 'change-me'
        return jwt.sign({ sub: userId, email }, secret, { expiresIn: '30d' })
    }

    issueAccessToken(userId: string, email: string): string {
        const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_REFRESH_SECRET ?? 'change-me'
        return jwt.sign({ sub: userId, email }, secret, { expiresIn: '15m' })
    }

    issuePasswordResetToken(userId: string, email: string): string {
        const secret =
            process.env.JWT_PASSWORD_RESET_SECRET ??
            process.env.JWT_ACCESS_SECRET ??
            process.env.JWT_REFRESH_SECRET ??
            'change-me'
        const expiresIn = (process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN ?? '1h') as jwt.SignOptions['expiresIn']

        return jwt.sign({ sub: userId, email, type: 'password_reset' }, secret, { expiresIn })
    }

    verifyPasswordResetToken(token: string): { userId: string; email: string } {
        const secret =
            process.env.JWT_PASSWORD_RESET_SECRET ??
            process.env.JWT_ACCESS_SECRET ??
            process.env.JWT_REFRESH_SECRET ??
            'change-me'

        try {
            const payload = jwt.verify(token, secret) as JwtPayload | string

            if (
                typeof payload === 'string' ||
                typeof payload.sub !== 'string' ||
                typeof payload.email !== 'string' ||
                payload.type !== 'password_reset'
            ) {
                throw new Error('Invalid reset token payload')
            }

            return { userId: payload.sub, email: payload.email }
        } catch (error) {
            this.logger.warn('Invalid password reset token', {
                operation: 'TokenService.verifyPasswordResetToken',
                error: formatError(error),
            })

            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }
    }

    verifyRefreshToken(refreshToken: string): { userId: string; email: string } {
        const secret = process.env.JWT_REFRESH_SECRET ?? 'change-me'

        try {
            const payload = jwt.verify(refreshToken, secret) as JwtPayload | string

            if (
                typeof payload === 'string' ||
                typeof payload.sub !== 'string' ||
                typeof payload.email !== 'string'
            ) {
                throw new Error('Invalid token payload')
            }

            return { userId: payload.sub, email: payload.email }
        } catch (error) {
            this.logger.warn('Invalid refresh token', {
                operation: 'TokenService.verifyRefreshToken',
                error: formatError(error),
            })

            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }
    }

    async validateRefreshToken(refreshToken?: string): Promise<User> {
        if (!refreshToken) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        const payload = this.verifyRefreshToken(refreshToken)
        const user = await this.userRepository.findByEmail(payload.email)

        if (!user || user.id !== payload.userId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        return user
    }
}
