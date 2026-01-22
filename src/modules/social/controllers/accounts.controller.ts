import type { NextFunction, Request, Response } from 'express'

import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'
import { getEnvVar } from '@/shared/utils/get-env-var'

import type { IAccountsService } from '@/modules/social/services/accounts.service.interface'
import type { ISocilaMediaConnectorService } from '@/modules/social/services/social-media-connector.interface'
import type { IOAuthStateService } from '@/modules/social/services/oauth-state.service'
import {
    accountIdParamSchema,
    blueskyConnectSchema,
    oauthCallbackSchema,
    oauthStateRequestSchema,
    socialAccountIdParamSchema,
} from '@/modules/social/validation/accounts.schemas'

export class AccountsController {
    private readonly accountsService: IAccountsService
    private readonly connectorService: ISocilaMediaConnectorService
    private readonly logger: ILogger
    private readonly oauthStateService: IOAuthStateService

    constructor(
        accountsService: IAccountsService,
        connectorService: ISocilaMediaConnectorService,
        logger: ILogger,
        oauthStateService: IOAuthStateService
    ) {
        this.accountsService = accountsService
        this.connectorService = connectorService
        this.logger = logger
        this.oauthStateService = oauthStateService
    }

    async initiateOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)

        const state = this.oauthStateService.create({ userId, platform: 'facebook' })

        res.json({ state })
    }

    async createOAuthState(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const payload = oauthStateRequestSchema.parse(req.body)

        const state = this.oauthStateService.create({
            userId,
            platform: payload.platform,
            codeVerifier: payload.codeVerifier,
        })

        res.status(201).json({ state })
    }

    async connectFacebookAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId

        const authCode = this.requireCode(code)
        await this.connectorService.connectFacebookAccount(userId, authCode)
        this.redirectToAccounts(res)
    }

    async connectThreadsAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId

        const authCode = this.requireCode(code)
        await this.connectorService.connectThreadsAccount(userId, authCode)
        this.redirectToAccounts(res)
    }

    async connectTikTokAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId

        const authCode = this.requireCode(code)
        await this.connectorService.connectTikTokAccount(userId, authCode)
        this.redirectToAccounts(res)
    }

    async connectYouTubeAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId

        const authCode = this.requireCode(code)
        await this.connectorService.connectYouTubeAccount(userId, authCode)
        this.redirectToAccounts(res)
    }

    async connectXAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description, code_verifier } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId
        const authCode = this.requireCode(code)

        const resolvedCodeVerifier = code_verifier ?? statePayload?.codeVerifier
        if (!resolvedCodeVerifier) {
            throw new BaseAppError('Missing X code verifier', ErrorCode.BAD_REQUEST, 400)
        }

        await this.connectorService.connectXAccount(userId, authCode, resolvedCodeVerifier)
        this.redirectToAccounts(res)
    }

    async connectPinterestAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId

        const authCode = this.requireCode(code)
        await this.connectorService.connectPinterestAccount(userId, authCode)
        this.redirectToAccounts(res)
    }

    async connectInstagramAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId

        const authCode = this.requireCode(code)
        await this.connectorService.connectInstagramAccount(userId, authCode)
        this.redirectToAccounts(res)
    }

    async connectLinkedinAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { code, state, error, error_description } = this.parseOAuthCallback(req)
        this.assertNoOAuthError(error, error_description)

        const statePayload = this.requireState(state)
        const userId = statePayload.userId

        const authCode = this.requireCode(code)
        await this.connectorService.connectLinkedinAccount(userId, authCode)
        this.redirectToAccounts(res)
    }

    async connectBlueskyAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const payload = blueskyConnectSchema.parse(req.body)

        const result = await this.connectorService.connectBlueskyAccount(
            userId,
            payload.identifier,
            payload.appPassword
        )

        res.json(result)
    }

    async getAllAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const accounts = await this.accountsService.getAllAccounts(userId)
        res.json(accounts)
    }

    async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const params = accountIdParamSchema.parse(req.params)

        const result = await this.accountsService.deleteAccount(userId, params.accountId)
        res.json(result)
    }

    async getPinterestBoards(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const params = socialAccountIdParamSchema.parse(req.params)

        const boards = await this.accountsService.getPinterestBoards(userId, params.socialAccountId)
        res.json(boards)
    }

    async getTikTokCreatorInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const params = socialAccountIdParamSchema.parse(req.params)

        const creatorInfo = await this.connectorService.getTikTokCreatorInfo(userId, params.socialAccountId)
        res.json(creatorInfo)
    }

    private getUserId(req: Request): string {
        const userId = req.user?.id

        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        return userId
    }

    private parseOAuthCallback(req: Request) {
        const normalized = this.normalizeQuery(req.query)
        return oauthCallbackSchema.parse(normalized)
    }

    private normalizeQuery(query: Request['query']): Record<string, string> {
        const normalized: Record<string, string> = {}

        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'string') {
                normalized[key] = value
                continue
            }

            if (Array.isArray(value)) {
                const [first] = value
                if (typeof first === 'string') {
                    normalized[key] = first
                }
            }
        }

        return normalized
    }

    private assertNoOAuthError(error?: string, description?: string) {
        if (error && error.trim() !== '') {
            this.logger.warn('OAuth callback returned error', {
                operation: 'AccountsController.assertNoOAuthError',
                error: { message: error },
                description,
            })

            throw new BaseAppError('OAuth authorization failed', ErrorCode.UNAUTHORIZED, 401)
        }
    }

    private requireState(state?: string) {
        if (!state) {
            throw new BaseAppError('Missing OAuth state', ErrorCode.UNAUTHORIZED, 401)
        }

        const payload = this.oauthStateService.consume(state)

        if (!payload || typeof payload.userId !== 'string') {
            throw new BaseAppError('Invalid OAuth state', ErrorCode.UNAUTHORIZED, 401)
        }

        return payload
    }

    private requireCode(code?: string) {
        if (!code) {
            throw new BaseAppError('Missing authorization code', ErrorCode.BAD_REQUEST, 400)
        }

        return code
    }

    private redirectToAccounts(res: Response) {
        const frontendUrl = getEnvVar('FRONTEND_URL')
        const redirectUrl = `${frontendUrl}/accounts`
        res.redirect(redirectUrl)
    }
}
