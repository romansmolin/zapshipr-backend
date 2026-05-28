import bcrypt from 'bcryptjs'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { AuthResult } from '../services/auth-service.interface'
import type { TokenService } from '../services/token.service'

export interface SignInInput {
    email: string
    password: string
}

export type SignInDeps = {
    users: IUserRepository
    tokens: TokenService
    logger: ILogger
}

export const signIn = async (
    { users, tokens, logger }: SignInDeps,
    payload: SignInInput
): Promise<AuthResult> => {
    const user = await users.findByEmail(payload.email)

    if (!user) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
            httpCode: 401,
        })
    }

    if (!user.passwordHash) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
            httpCode: 401,
        })
    }

    const validPassword = await bcrypt.compare(payload.password, user.passwordHash)

    if (!validPassword) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
            httpCode: 401,
        })
    }

    const refreshToken = tokens.issueRefreshToken(user.id, user.email)
    const accessToken = tokens.issueAccessToken(user.id, user.email)

    logger.info('User signed in', { operation: 'signIn', userId: user.id })

    return { user, refreshToken, accessToken }
}
