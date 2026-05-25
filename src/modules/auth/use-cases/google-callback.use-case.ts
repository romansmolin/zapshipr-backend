import { randomUUID } from 'crypto'
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'
import { getEnvVar } from '@/shared/utils/get-env-var'
import type { AuthResult } from '../services/auth-service.interface'
import { TokenService } from '../services/token.service'

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

export class GoogleCallbackUseCase {
    private googleOAuthClient: OAuth2Client | null = null

    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: TokenService,
        private readonly logger: ILogger
    ) {}

    async execute(code: string): Promise<AuthResult> {
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
        let wasCreated = false

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
                wasCreated = true
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

        const refreshToken = this.tokenService.issueRefreshToken(user.id, user.email)
        const accessToken = this.tokenService.issueAccessToken(user.id, user.email)

        this.logger.info('Google auth completed', {
            operation: 'GoogleCallbackUseCase.execute',
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
                operation: 'GoogleCallbackUseCase.getGoogleOAuthConfig',
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
                operation: 'GoogleCallbackUseCase.exchangeGoogleCode',
                error: formatError(error),
            })

            throw new AppError({
                errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            })
        }
    }
}
