import type { ILogger } from '@/shared/logger/logger.interface'

import type { AuthResult } from '../services/auth/auth-service.interface'
import type { TokenService } from '../services/token/token.service'

export type GetSessionDeps = {
    tokens: TokenService
    logger: ILogger
}

export const getSession = async (
    { tokens, logger }: GetSessionDeps,
    refreshToken?: string
): Promise<AuthResult> => {
    const user = await tokens.validateRefreshToken(refreshToken)

    const nextRefreshToken = tokens.issueRefreshToken(user.id, user.email)
    const accessToken = tokens.issueAccessToken(user.id, user.email)

    logger.info('Session retrieved', { operation: 'getSession', userId: user.id })

    return { user, refreshToken: nextRefreshToken, accessToken }
}
