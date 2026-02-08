import type { ILogger } from '@/shared/logger/logger.interface'
import type { RefreshResult } from '../services/auth-service.interface'
import { TokenService } from '../services/token.service'

export class RefreshTokenUseCase {
    constructor(
        private readonly tokenService: TokenService,
        private readonly logger: ILogger
    ) {}

    async execute(refreshToken?: string): Promise<RefreshResult> {
        const user = await this.tokenService.validateRefreshToken(refreshToken)

        const nextRefreshToken = this.tokenService.issueRefreshToken(user.id, user.email)
        const accessToken = this.tokenService.issueAccessToken(user.id, user.email)

        this.logger.info('Token refreshed', { operation: 'RefreshTokenUseCase.execute', userId: user.id })

        return { refreshToken: nextRefreshToken, accessToken }
    }
}
