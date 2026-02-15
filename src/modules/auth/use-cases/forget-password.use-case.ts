import type { IEmailService } from '@/modules/email/services/email.service.interface'
import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

import { TokenService } from '../services/token.service'

export interface ForgetPasswordInput {
    email: string
}

export class ForgetPasswordUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: TokenService,
        private readonly emailService: IEmailService,
        private readonly logger: ILogger
    ) {}

    private buildResetLink(token: string): string {
        const baseUrl = (process.env.PASSWORD_RESET_URL_BASE ?? process.env.FRONTEND_URL ?? '').trim()

        if (!baseUrl) {
            throw new Error('PASSWORD_RESET_URL_BASE or FRONTEND_URL must be set')
        }

        const resetUrl = new URL('/reset-password', baseUrl)
        resetUrl.searchParams.set('token', token)
        return resetUrl.toString()
    }

    async execute(payload: ForgetPasswordInput): Promise<void> {
        const email = payload.email.trim().toLowerCase()
        const user = await this.userRepository.findByEmail(email)

        // Do not reveal whether the email exists.
        if (!user) {
            this.logger.info('Password reset requested for non-existing email', {
                operation: 'ForgetPasswordUseCase.execute',
                email,
            })
            return
        }

        const token = this.tokenService.issuePasswordResetToken(user.id, user.email)
        const resetLink = this.buildResetLink(token)

        await this.emailService.sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetLink,
            token,
        })

        this.logger.info('Password reset email queued', {
            operation: 'ForgetPasswordUseCase.execute',
            userId: user.id,
            email: user.email,
        })
    }
}
