import bcrypt from 'bcryptjs'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { AuthResult } from '../services/auth-service.interface'
import { TokenService } from '../services/token.service'

export interface SignInInput {
    email: string
    password: string
}

export class SignInUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: TokenService,
        private readonly logger: ILogger
    ) {}

    async execute(payload: SignInInput): Promise<AuthResult> {
        const user = await this.userRepository.findByEmail(payload.email)

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

        const refreshToken = this.tokenService.issueRefreshToken(user.id, user.email)
        const accessToken = this.tokenService.issueAccessToken(user.id, user.email)

        this.logger.info('User signed in', { operation: 'SignInUseCase.execute', userId: user.id })

        return { user, refreshToken, accessToken }
    }
}
