import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { AuthResult } from '../services/auth-service.interface'
import { TokenService } from '../services/token.service'

export interface SignUpInput {
    name: string
    email: string
    password: string
}

export class SignUpUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: TokenService,
        private readonly logger: ILogger
    ) {}

    async execute(payload: SignUpInput): Promise<AuthResult> {
        const existing = await this.userRepository.findByEmail(payload.email)

        if (existing) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.USER_ALREADY_EXISTS,
                httpCode: 409,
            })
        }

        const passwordHash = await bcrypt.hash(payload.password, 10)

        const user = await this.userRepository.createUser({
            id: randomUUID(),
            name: payload.name,
            email: payload.email,
            passwordHash,
            googleAuth: false,
        })

        const refreshToken = this.tokenService.issueRefreshToken(user.id, user.email)
        const accessToken = this.tokenService.issueAccessToken(user.id, user.email)

        this.logger.info('User signed up', { operation: 'SignUpUseCase.execute', userId: user.id })

        return { user, refreshToken, accessToken }
    }
}
