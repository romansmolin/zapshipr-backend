import type { IEmailService } from '@/modules/email/services/email/email.service.interface'
import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { TokenService } from '../services/token/token.service'

export interface ForgetPasswordInput {
    email: string
}

export type ForgetPasswordDeps = {
    users: IUserRepository
    tokens: TokenService
    emailService: IEmailService
    logger: ILogger
}

const buildResetLink = (token: string): string => {
    const baseUrl = (process.env.PASSWORD_RESET_URL_BASE ?? process.env.FRONTEND_URL ?? '').trim()

    if (!baseUrl) {
        throw new Error('PASSWORD_RESET_URL_BASE or FRONTEND_URL must be set')
    }

    const resetUrl = new URL('/reset-password', baseUrl)
    resetUrl.searchParams.set('token', token)
    return resetUrl.toString()
}

export const forgetPassword = async (
    { users, tokens, emailService, logger }: ForgetPasswordDeps,
    payload: ForgetPasswordInput
): Promise<void> => {
    const email = payload.email.trim().toLowerCase()
    const user = await users.findByEmail(email)

    if (!user) {
        logger.info('Password reset requested for non-existing email', {
            operation: 'forgetPassword',
            email,
        })
        return
    }

    const token = tokens.issuePasswordResetToken(user.id, user.email)
    const resetLink = buildResetLink(token)

    await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetLink,
        token,
    })

    logger.info('Password reset email queued', {
        operation: 'forgetPassword',
        userId: user.id,
        email: user.email,
    })
}
