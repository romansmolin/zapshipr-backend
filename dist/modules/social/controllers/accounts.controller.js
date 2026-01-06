"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsController = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const accounts_schemas_1 = require("@/modules/social/validation/accounts.schemas");
class AccountsController {
    constructor(accountsService, connectorService, logger, oauthStateService) {
        this.accountsService = accountsService;
        this.connectorService = connectorService;
        this.logger = logger;
        this.oauthStateService = oauthStateService;
    }
    async initiateOAuth(req, res, next) {
        const userId = this.getUserId(req);
        const state = this.oauthStateService.create({ userId, platform: 'facebook' });
        res.json({ state });
    }
    async createOAuthState(req, res, next) {
        const userId = this.getUserId(req);
        const payload = accounts_schemas_1.oauthStateRequestSchema.parse(req.body);
        const state = this.oauthStateService.create({
            userId,
            platform: payload.platform,
            codeVerifier: payload.codeVerifier,
        });
        res.status(201).json({ state });
    }
    async connectFacebookAccount(req, res, next) {
        const { code, state, error, error_description } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const result = await this.connectorService.connectFacebookAccount(userId, authCode);
        res.json(result);
    }
    async connectThreadsAccount(req, res, next) {
        const { code, state, error, error_description } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const result = await this.connectorService.connectThreadsAccount(userId, authCode);
        res.json(result);
    }
    async connectTikTokAccount(req, res, next) {
        const { code, state, error, error_description } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const result = await this.connectorService.connectTikTokAccount(userId, authCode);
        res.json(result);
    }
    async connectYouTubeAccount(req, res, next) {
        const { code, state, error, error_description } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const result = await this.connectorService.connectYouTubeAccount(userId, authCode);
        res.json(result);
    }
    async connectXAccount(req, res, next) {
        const { code, state, error, error_description, code_verifier } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        const statePayload = this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const resolvedCodeVerifier = code_verifier ?? statePayload?.codeVerifier;
        if (!resolvedCodeVerifier) {
            throw new base_error_1.BaseAppError('Missing X code verifier', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        const result = await this.connectorService.connectXAccount(userId, authCode, resolvedCodeVerifier);
        res.json(result);
    }
    async connectPinterestAccount(req, res, next) {
        const { code, state, error, error_description } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const result = await this.connectorService.connectPinterestAccount(userId, authCode);
        res.json(result);
    }
    async connectInstagramAccount(req, res, next) {
        const { code, state, error, error_description } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const result = await this.connectorService.connectInstagramAccount(userId, authCode);
        res.json(result);
    }
    async connectLinkedinAccount(req, res, next) {
        const { code, state, error, error_description } = this.parseOAuthCallback(req);
        this.assertNoOAuthError(error, error_description);
        const userId = this.getUserId(req);
        this.validateState(userId, state);
        const authCode = this.requireCode(code);
        const result = await this.connectorService.connectLinkedinAccount(userId, authCode);
        res.json(result);
    }
    async connectBlueskyAccount(req, res, next) {
        const userId = this.getUserId(req);
        const payload = accounts_schemas_1.blueskyConnectSchema.parse(req.body);
        const result = await this.connectorService.connectBlueskyAccount(userId, payload.identifier, payload.appPassword);
        res.json(result);
    }
    async getAllAccounts(req, res, next) {
        const userId = this.getUserId(req);
        const accounts = await this.accountsService.getAllAccounts(userId);
        res.json(accounts);
    }
    async deleteAccount(req, res, next) {
        const userId = this.getUserId(req);
        const params = accounts_schemas_1.accountIdParamSchema.parse(req.params);
        const result = await this.accountsService.deleteAccount(userId, params.accountId);
        res.json(result);
    }
    async getPinterestBoards(req, res, next) {
        const userId = this.getUserId(req);
        const params = accounts_schemas_1.socialAccountIdParamSchema.parse(req.params);
        const boards = await this.accountsService.getPinterestBoards(userId, params.socialAccountId);
        res.json(boards);
    }
    getUserId(req) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        return userId;
    }
    parseOAuthCallback(req) {
        const normalized = this.normalizeQuery(req.query);
        return accounts_schemas_1.oauthCallbackSchema.parse(normalized);
    }
    normalizeQuery(query) {
        const normalized = {};
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'string') {
                normalized[key] = value;
                continue;
            }
            if (Array.isArray(value)) {
                const [first] = value;
                if (typeof first === 'string') {
                    normalized[key] = first;
                }
            }
        }
        return normalized;
    }
    assertNoOAuthError(error, description) {
        if (error && error.trim() !== '') {
            this.logger.warn('OAuth callback returned error', {
                operation: 'AccountsController.assertNoOAuthError',
                error: { message: error },
                description,
            });
            throw new base_error_1.BaseAppError('OAuth authorization failed', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
    }
    validateState(userId, state) {
        if (!state)
            return null;
        const payload = this.oauthStateService.consume(state);
        if (!payload || payload.userId !== userId) {
            throw new base_error_1.BaseAppError('Invalid OAuth state', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        return payload;
    }
    requireCode(code) {
        if (!code) {
            throw new base_error_1.BaseAppError('Missing authorization code', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        return code;
    }
}
exports.AccountsController = AccountsController;
