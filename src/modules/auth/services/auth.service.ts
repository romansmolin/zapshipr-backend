import { randomUUID } from 'crypto'

import axios from 'axios'
import bcrypt from 'bcryptjs'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'
import { getEnvVar } from '@/shared/utils/get-env-var'

import type { AuthResult, IAuthService, RefreshResult, SignInInput, SignUpInput } from './auth-service.interface'

interface GoogleOAuthConfig {
    clientId: string
    clientSecret: string
    redirectUri: string
}

interface GoogleTokenResponse {
    access_token: string
    expires_in: number
    id_token: string
    scope?: string
    token_type?: string
}

export class AuthService implements IAuthService {
    private readonly userRepository: IUserRepository
    private readonly logger: ILogger
    private googleOAuthClient: OAuth2Client | null = null

    constructor(userRepository: IUserRepository, logger: ILogger) {
        this.userRepository = userRepository
        this.logger = logger
    }

    async signUp(payload: SignUpInput): Promise<AuthResult> {
        const existing = await this.userRepository.findByEmail(payload.email)

        if (existing)
            throw new AppError({
                errorMessageCode: ErrorMessageCode.USER_ALREADY_EXISTS,
                httpCode: 409,
            })

        const passwordHash = await bcrypt.hash(payload.password, 10)

        const user = await this.userRepository.createUser({
            id: randomUUID(),
            name: payload.name,
            email: payload.email,
            passwordHash,
            googleAuth: false,
        })

        const refreshToken = this.issueRefreshToken(user.id, user.email)
        const accessToken = this.issueAccessToken(user.id, user.email)

        this.logger.info('User signed up', { operation: 'AuthService.signUp', userId: user.id })

        return { user, refreshToken, accessToken }
    }

    async signIn(payload: SignInInput): Promise<AuthResult> {
        const user = await this.userRepository.findByEmail(payload.email)

        if (!user)
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
                httpCode: 401,
            })

        if (!user.passwordHash)
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
                httpCode: 401,
            })

        const validPassword = await bcrypt.compare(payload.password, user.passwordHash)

        if (!validPassword)
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
                httpCode: 401,
            })

        const refreshToken = this.issueRefreshToken(user.id, user.email)
        const accessToken = this.issueAccessToken(user.id, user.email)

        this.logger.info('User signed in', { operation: 'AuthService.signIn', userId: user.id })

        return { user, refreshToken, accessToken }
    }

    async changePassword(): Promise<void> {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.NOT_IMPLEMENTED,
            httpCode: 501,
        })
    }

    async forgetPassword(): Promise<void> {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.NOT_IMPLEMENTED,
            httpCode: 501,
        })
    }

    async getSession(refreshToken?: string): Promise<AuthResult> {
        const user = await this.validateRefreshToken(refreshToken)

        const nextRefreshToken = this.issueRefreshToken(user.id, user.email)
        const accessToken = this.issueAccessToken(user.id, user.email)

        return { user, refreshToken: nextRefreshToken, accessToken }
    }

    async refresh(refreshToken?: string): Promise<RefreshResult> {
        const user = await this.validateRefreshToken(refreshToken)

        const nextRefreshToken = this.issueRefreshToken(user.id, user.email)
        const accessToken = this.issueAccessToken(user.id, user.email)

        return { refreshToken: nextRefreshToken, accessToken }
    }

    async logout(): Promise<void> {
        this.logger.info('User logged out', { operation: 'AuthService.logout' })
    }

    private async validateRefreshToken(refreshToken?: string) {
        if (!refreshToken) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        const payload = this.verifyRefreshToken(refreshToken)
        const user = await this.userRepository.findByEmail(payload.email)

        if (!user || user.id !== payload.userId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        return user
    }

    private verifyRefreshToken(refreshToken: string): { userId: string; email: string } {
        const secret = process.env.JWT_REFRESH_SECRET ?? 'change-me'

        try {
            const payload = jwt.verify(refreshToken, secret) as JwtPayload | string

            if (
                typeof payload === 'string' ||
                typeof payload.sub !== 'string' ||
                typeof payload.email !== 'string'
            ) {
                throw new Error('Invalid token payload')
            }

            return { userId: payload.sub, email: payload.email }
        } catch (error) {
            this.logger.warn('Invalid refresh token', {
                operation: 'AuthService.verifyRefreshToken',
                error: formatError(error),
            })

            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }
    }

    private issueRefreshToken(userId: string, email: string) {
        const secret = process.env.JWT_REFRESH_SECRET ?? 'change-me'
        return jwt.sign({ sub: userId, email }, secret, { expiresIn: '30d' })
    }

    private issueAccessToken(userId: string, email: string) {
        const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_REFRESH_SECRET ?? 'change-me'
        return jwt.sign({ sub: userId, email }, secret, { expiresIn: '15m' })
    }

    // GOOGLE AUTH LOGIC

    async googleCallback(code: string): Promise<AuthResult> {
        const config = this.getGoogleOAuthConfig()

        const tokenResponse = await this.exchangeGoogleCode(code, config)

        if (!tokenResponse?.id_token) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        const ticket = await this.getGoogleClient().verifyIdToken({
            idToken: tokenResponse.id_token,
            audience: config.clientId,
        })

        const payload = ticket.getPayload()

        if (!payload?.email || !payload.sub) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        if (payload.email_verified === false) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        let user = await this.userRepository.findByEmail(payload.email)

        if (!user) {
            const name = payload.given_name || payload.name || payload.email
            const avatar = payload.picture || null

            try {
                user = await this.userRepository.createUser({
                    id: randomUUID(),
                    name,
                    email: payload.email,
                    passwordHash: null,
                    googleAuth: true,
                    avatar,
                })
            } catch (error) {
                if (error instanceof AppError && error.errorMessageCode === ErrorMessageCode.USER_ALREADY_EXISTS) {
                    user = await this.userRepository.findByEmail(payload.email)
                } else {
                    throw error
                }
            }
        }

        if (!user) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }

        const refreshToken = this.issueRefreshToken(user.id, user.email)
        const accessToken = this.issueAccessToken(user.id, user.email)

        this.logger.info('Google auth completed', {
            operation: 'AuthService.googleCallback',
            userId: user.id,
        })

        return { user, refreshToken, accessToken }
    }

    private getGoogleClient(): OAuth2Client {
        if (!this.googleOAuthClient) {
            const clientId = getEnvVar('GOOGLE_CLIENT_ID')
            if (!clientId) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
                    httpCode: 500,
                })
            }
            this.googleOAuthClient = new OAuth2Client(clientId)
        }

        return this.googleOAuthClient
    }

    private getGoogleOAuthConfig(): GoogleOAuthConfig {
        const clientId = getEnvVar('GOOGLE_CLIENT_ID')
        const clientSecret = getEnvVar('GOOGLE_CLIENT_SECRET')
        const backendUrl = getEnvVar('BACKEND_URL')
        const redirectUri = getEnvVar('GOOGLE_REDIRECT_URI') || `${backendUrl}/auth/callback/google`

        if (!clientId || !clientSecret) {
            this.logger.error('Missing Google OAuth configuration', {
                operation: 'AuthService.getGoogleOAuthConfig',
            })
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
                httpCode: 500,
            })
        }

        return { clientId, clientSecret, redirectUri }
    }

    private async exchangeGoogleCode(code: string, config: GoogleOAuthConfig): Promise<GoogleTokenResponse> {
        try {
            const response = await axios.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', null, {
                params: {
                    code,
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    redirect_uri: config.redirectUri,
                    grant_type: 'authorization_code',
                },
            })

            if (!response.data?.id_token) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                    httpCode: 401,
                })
            }

            return response.data
        } catch (error) {
            if (error instanceof AppError) throw error

            this.logger.warn('Google token exchange failed', {
                operation: 'AuthService.exchangeGoogleCode',
                error: formatError(error),
            })

            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }
    }
}
