import type { CookieOptions, NextFunction, Request, Response } from 'express'

import type { ILogger } from '@/shared/logger/logger.interface'
import { toUserResponse } from '@/modules/user/entity/user.dto'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { getEnvVar } from '@/shared/utils/get-env-var'

import type { IAuthController } from './auth-controller.interface'
import type { AuthResult, IAuthService } from '../services/auth-service.interface'
import { googleCallbackSchema, signInSchema, signUpSchema } from '../validation/auth.schemas'

export class AuthController implements IAuthController {
    private readonly logger: ILogger
    private readonly authService: IAuthService

    constructor(authService: IAuthService, logger: ILogger) {
        this.logger = logger
        this.authService = authService
    }

    async signIn(req: Request, res: Response, next: NextFunction): Promise<void> {
        const payload = signInSchema.parse(req.body)

        const result = await this.authService.signIn(payload)

        this.setAuthCookie(req, res, result.refreshToken)

        this.logger.info('User signed in', { operation: 'AuthController.signIn', userId: result.user.id })

        res.json({ user: this.toSafeUser(result.user), accessToken: result.accessToken })
    }

    async signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
        const payload = signUpSchema.parse(req.body)

        const result = await this.authService.signUp(payload)

        this.setAuthCookie(req, res, result.refreshToken)

        this.logger.info('User signed up', { operation: 'AuthController.signUp', userId: result.user.id })

        res.status(201).json({ user: this.toSafeUser(result.user), accessToken: result.accessToken })
    }

    async forgetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
        await this.authService.forgetPassword()
        res.status(204).end()
    }

    async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
        await this.authService.changePassword()
        res.status(204).end()
    }

    async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
        const error = req.query?.error
        const errorValue = Array.isArray(error) ? error[0] : error

        if (typeof errorValue === 'string' && errorValue.trim() !== '') {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        const payload = googleCallbackSchema.parse(req.query)

        const result = await this.authService.googleCallback(payload.code)

        this.logger.debug('TOKEN: ', { token: result.refreshToken })
        this.setAuthCookie(req, res, result.refreshToken)

        this.logger.info('Google auth callback handled', {
            operation: 'AuthController.googleCallback',
            userId: result.user.id,
        })

        const frontendUrl = getEnvVar('FRONTEND_URL')
        const redirectUrl = `${frontendUrl}/all-posts?userId=${result.user.id}`

        this.logger.info('Redirecting to frontend', {
            operation: 'AuthController.googleCallback',
            redirectUrl: `${frontendUrl}/all-posts?userId=${result.user.id}`,
        })

        res.redirect(redirectUrl)
    }

    async authMe(req: Request, res: Response, next: NextFunction): Promise<void> {
        const refreshToken = req.cookies?.token

        const result = await this.authService.getSession(refreshToken)

        this.setAuthCookie(req, res, result.refreshToken)

        this.logger.info('Session validated via cookie', {
            operation: 'AuthController.authMe',
            userId: result.user.id,
        })

        res.json({ user: this.toSafeUser(result.user), accessToken: result.accessToken })
    }

    async authRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
        const refreshToken = req.cookies?.token

        const result = await this.authService.refresh(refreshToken)

        this.setAuthCookie(req, res, result.refreshToken)

        this.logger.info('Access token refreshed', {
            operation: 'AuthController.authRefresh',
        })

        res.json({ accessToken: result.accessToken })
    }

    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        await this.authService.logout()
        this.clearAuthCookie(req, res)
        res.status(204).end()
    }

    private toSafeUser(user: AuthResult['user']) {
        return toUserResponse(user)
    }

    // AUTH COOKIES LOGIC

    private getRefreshCookieOptions(req?: Request): CookieOptions {
        const sameSiteEnv = process.env.AUTH_COOKIE_SAMESITE?.toLowerCase()
        const sameSite =
            sameSiteEnv === 'none' || sameSiteEnv === 'lax' || sameSiteEnv === 'strict'
                ? (sameSiteEnv as 'none' | 'lax' | 'strict')
                : 'lax'

        const forwardedProto = req?.headers['x-forwarded-proto']
        const forwardedProtoValue = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto
        const isHttps =
            req?.secure || (typeof forwardedProtoValue === 'string' && forwardedProtoValue.split(',')[0].trim() === 'https')

        const secureEnv = process.env.AUTH_COOKIE_SECURE?.toLowerCase()
        let secure =
            secureEnv === 'true' ? true : secureEnv === 'false' ? false : isHttps || process.env.NODE_ENV === 'production'

        if (sameSite === 'none') {
            secure = true
        }

        const domain = process.env.AUTH_COOKIE_DOMAIN?.trim()
        const path = process.env.AUTH_COOKIE_PATH?.trim() || '/'
        const maxAgeDays = Number.parseInt(process.env.AUTH_COOKIE_MAX_AGE_DAYS ?? '7', 10)
        const maxAge = Number.isFinite(maxAgeDays) ? maxAgeDays * 24 * 60 * 60 * 1000 : 1000 * 60 * 60 * 24 * 7

        const options: CookieOptions = {
            httpOnly: true,
            sameSite,
            secure,
            path,
            maxAge,
        }

        if (domain) {
            options.domain = domain
        }

        return options
    }

    private setAuthCookie(req: Request, res: Response, refreshToken: string) {
        res.cookie('token', refreshToken, this.getRefreshCookieOptions(req))
    }

    private clearAuthCookie(req: Request, res: Response) {
        const { maxAge, ...options } = this.getRefreshCookieOptions(req)
        res.clearCookie('token', options)
    }
}
