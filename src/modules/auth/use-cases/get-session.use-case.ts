import type { ILogger } from '@/shared/logger/logger.interface'
import type { AuthResult } from '../services/auth-service.interface'
import { TokenService } from '../services/token.service'

export class GetSessionUseCase {
    constructor(
        private readonly tokenService: TokenService,
        private readonly logger: ILogger
    ) {}

    async execute(refreshToken?: string): Promise<AuthResult> {
        const user = await this.tokenService.validateRefreshToken(refreshToken)

        const nextRefreshToken = this.tokenService.issueRefreshToken(user.id, user.email)
        const accessToken = this.tokenService.issueAccessToken(user.id, user.email)

        this.logger.info('Session retrieved', { operation: 'GetSessionUseCase.execute', userId: user.id })

        return { user, refreshToken: nextRefreshToken, accessToken }
    }
}
