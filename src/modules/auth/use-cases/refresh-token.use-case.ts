import type { ILogger } from '@/shared/logger/logger.interface'

import type { RefreshResult } from '../services/auth-service.interface'
import type { TokenService } from '../services/token.service'

export type RefreshTokenDeps = {
    tokens: TokenService
    logger: ILogger
}

export const refreshToken = async (
    { tokens, logger }: RefreshTokenDeps,
    token?: string
): Promise<RefreshResult> => {
    const user = await tokens.validateRefreshToken(token)

    const nextRefreshToken = tokens.issueRefreshToken(user.id, user.email)
    const accessToken = tokens.issueAccessToken(user.id, user.email)

    logger.info('Token refreshed', { operation: 'refreshToken', userId: user.id })

    return { refreshToken: nextRefreshToken, accessToken }
}
