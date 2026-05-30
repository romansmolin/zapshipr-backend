import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { AuthResult } from '../services/auth/auth-service.interface'
import type { TokenService } from '../services/token/token.service'

export interface SignUpInput {
    name: string
    email: string
    password: string
}

export type SignUpDeps = {
    users: IUserRepository
    tokens: TokenService
    logger: ILogger
}

export const signUp = async (
    { users, tokens, logger }: SignUpDeps,
    payload: SignUpInput
): Promise<AuthResult> => {
    const existing = await users.findByEmail(payload.email)

    if (existing) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.USER_ALREADY_EXISTS,
            httpCode: 409,
        })
    }

    const passwordHash = await bcrypt.hash(payload.password, 10)

    const user = await users.createUser({
        id: randomUUID(),
        name: payload.name,
        email: payload.email,
        passwordHash,
        googleAuth: false,
    })

    const refreshToken = tokens.issueRefreshToken(user.id, user.email)
    const accessToken = tokens.issueAccessToken(user.id, user.email)

    logger.info('User signed up', { operation: 'signUp', userId: user.id })

    return { user, refreshToken, accessToken }
}
