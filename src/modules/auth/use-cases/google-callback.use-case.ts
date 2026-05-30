import { randomUUID } from 'crypto'
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'

import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'
import { getEnvVar } from '@/shared/utils/get-env-var'

import type { AuthResult } from '../services/auth/auth-service.interface'
import type { TokenService } from '../services/token/token.service'

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

export type GoogleCallbackDeps = {
    users: IUserRepository
    tokens: TokenService
    logger: ILogger
}

let googleOAuthClient: OAuth2Client | null = null

const getGoogleClient = (): OAuth2Client => {
    if (!googleOAuthClient) {
        const clientId = getEnvVar('GOOGLE_CLIENT_ID')
        if (!clientId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
                httpCode: 500,
            })
        }
        googleOAuthClient = new OAuth2Client(clientId)
    }

    return googleOAuthClient
}

const getGoogleOAuthConfig = (logger: ILogger): GoogleOAuthConfig => {
    const clientId = getEnvVar('GOOGLE_CLIENT_ID')
    const clientSecret = getEnvVar('GOOGLE_CLIENT_SECRET')
    const backendUrl = getEnvVar('BACKEND_URL')
    const redirectUri = getEnvVar('GOOGLE_REDIRECT_URI') || `${backendUrl}/auth/callback/google`

    if (!clientId || !clientSecret) {
        logger.error('Missing Google OAuth configuration', {
            operation: 'googleCallback.getGoogleOAuthConfig',
        })
        throw new AppError({
            errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
            httpCode: 500,
        })
    }

    return { clientId, clientSecret, redirectUri }
}

const exchangeGoogleCode = async (
    code: string,
    config: GoogleOAuthConfig,
    logger: ILogger
): Promise<GoogleTokenResponse> => {
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

        logger.warn('Google token exchange failed', {
            operation: 'googleCallback.exchangeGoogleCode',
            error: formatError(error),
        })

        throw new AppError({
            errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
            httpCode: 401,
        })
    }
}

export const googleCallback = async (
    { users, tokens, logger }: GoogleCallbackDeps,
    code: string
): Promise<AuthResult> => {
    const config = getGoogleOAuthConfig(logger)
    const tokenResponse = await exchangeGoogleCode(code, config, logger)

    if (!tokenResponse?.id_token) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.UNAUTHORIZED,
            httpCode: 401,
        })
    }

    const ticket = await getGoogleClient().verifyIdToken({
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

    let user = await users.findByEmail(payload.email)

    if (!user) {
        const name = payload.given_name || payload.name || payload.email
        const avatar = payload.picture || null

        try {
            user = await users.createUser({
                id: randomUUID(),
                name,
                email: payload.email,
                passwordHash: null,
                googleAuth: true,
                avatar,
            })
        } catch (error) {
            if (error instanceof AppError && error.errorMessageCode === ErrorMessageCode.USER_ALREADY_EXISTS) {
                user = await users.findByEmail(payload.email)
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

    const refreshToken = tokens.issueRefreshToken(user.id, user.email)
    const accessToken = tokens.issueAccessToken(user.id, user.email)

    logger.info('Google auth completed', {
        operation: 'googleCallback',
        userId: user.id,
    })

    return { user, refreshToken, accessToken }
}
