"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = require("crypto");
const axios_1 = __importDefault(require("axios"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const app_error_1 = require("@/shared/errors/app-error");
const forma_error_1 = require("@/shared/utils/forma-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
class AuthService {
    constructor(userRepository, logger) {
        this.googleOAuthClient = null;
        this.userRepository = userRepository;
        this.logger = logger;
    }
    async signUp(payload) {
        const existing = await this.userRepository.findByEmail(payload.email);
        if (existing)
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.USER_ALREADY_EXISTS,
                httpCode: 409,
            });
        const passwordHash = await bcryptjs_1.default.hash(payload.password, 10);
        const user = await this.userRepository.createUser({
            id: (0, crypto_1.randomUUID)(),
            name: payload.name,
            email: payload.email,
            passwordHash,
            googleAuth: false,
        });
        const refreshToken = this.issueRefreshToken(user.id, user.email);
        const accessToken = this.issueAccessToken(user.id, user.email);
        this.logger.info('User signed up', { operation: 'AuthService.signUp', userId: user.id });
        return { user, refreshToken, accessToken };
    }
    async signIn(payload) {
        const user = await this.userRepository.findByEmail(payload.email);
        if (!user)
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.INVALID_CREDENTIALS,
                httpCode: 401,
            });
        if (!user.passwordHash)
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.INVALID_CREDENTIALS,
                httpCode: 401,
            });
        const validPassword = await bcryptjs_1.default.compare(payload.password, user.passwordHash);
        if (!validPassword)
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.INVALID_CREDENTIALS,
                httpCode: 401,
            });
        const refreshToken = this.issueRefreshToken(user.id, user.email);
        const accessToken = this.issueAccessToken(user.id, user.email);
        this.logger.info('User signed in', { operation: 'AuthService.signIn', userId: user.id });
        return { user, refreshToken, accessToken };
    }
    async changePassword() {
        throw new app_error_1.AppError({
            errorMessageCode: app_error_1.ErrorMessageCode.NOT_IMPLEMENTED,
            httpCode: 501,
        });
    }
    async forgetPassword() {
        throw new app_error_1.AppError({
            errorMessageCode: app_error_1.ErrorMessageCode.NOT_IMPLEMENTED,
            httpCode: 501,
        });
    }
    async getSession(refreshToken) {
        const user = await this.validateRefreshToken(refreshToken);
        const nextRefreshToken = this.issueRefreshToken(user.id, user.email);
        const accessToken = this.issueAccessToken(user.id, user.email);
        return { user, refreshToken: nextRefreshToken, accessToken };
    }
    async refresh(refreshToken) {
        const user = await this.validateRefreshToken(refreshToken);
        const nextRefreshToken = this.issueRefreshToken(user.id, user.email);
        const accessToken = this.issueAccessToken(user.id, user.email);
        return { refreshToken: nextRefreshToken, accessToken };
    }
    async logout() {
        this.logger.info('User logged out', { operation: 'AuthService.logout' });
    }
    async validateRefreshToken(refreshToken) {
        if (!refreshToken) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
        const payload = this.verifyRefreshToken(refreshToken);
        const user = await this.userRepository.findByEmail(payload.email);
        if (!user || user.id !== payload.userId) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
        return user;
    }
    verifyRefreshToken(refreshToken) {
        const secret = process.env.JWT_REFRESH_SECRET ?? 'change-me';
        try {
            const payload = jsonwebtoken_1.default.verify(refreshToken, secret);
            if (typeof payload === 'string' ||
                typeof payload.sub !== 'string' ||
                typeof payload.email !== 'string') {
                throw new Error('Invalid token payload');
            }
            return { userId: payload.sub, email: payload.email };
        }
        catch (error) {
            this.logger.warn('Invalid refresh token', {
                operation: 'AuthService.verifyRefreshToken',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
    }
    issueRefreshToken(userId, email) {
        const secret = process.env.JWT_REFRESH_SECRET ?? 'change-me';
        return jsonwebtoken_1.default.sign({ sub: userId, email }, secret, { expiresIn: '30d' });
    }
    issueAccessToken(userId, email) {
        const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_REFRESH_SECRET ?? 'change-me';
        return jsonwebtoken_1.default.sign({ sub: userId, email }, secret, { expiresIn: '15m' });
    }
    // GOOGLE AUTH LOGIC
    async googleCallback(code) {
        const config = this.getGoogleOAuthConfig();
        const tokenResponse = await this.exchangeGoogleCode(code, config);
        if (!tokenResponse?.id_token) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
        const ticket = await this.getGoogleClient().verifyIdToken({
            idToken: tokenResponse.id_token,
            audience: config.clientId,
        });
        const payload = ticket.getPayload();
        if (!payload?.email || !payload.sub) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
        if (payload.email_verified === false) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
        let user = await this.userRepository.findByEmail(payload.email);
        if (!user) {
            const name = payload.given_name || payload.name || payload.email;
            const avatar = payload.picture || null;
            try {
                user = await this.userRepository.createUser({
                    id: (0, crypto_1.randomUUID)(),
                    name,
                    email: payload.email,
                    passwordHash: null,
                    googleAuth: true,
                    avatar,
                });
            }
            catch (error) {
                if (error instanceof app_error_1.AppError && error.errorMessageCode === app_error_1.ErrorMessageCode.USER_ALREADY_EXISTS) {
                    user = await this.userRepository.findByEmail(payload.email);
                }
                else {
                    throw error;
                }
            }
        }
        if (!user) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
        const refreshToken = this.issueRefreshToken(user.id, user.email);
        const accessToken = this.issueAccessToken(user.id, user.email);
        this.logger.info('Google auth completed', {
            operation: 'AuthService.googleCallback',
            userId: user.id,
        });
        return { user, refreshToken, accessToken };
    }
    getGoogleClient() {
        if (!this.googleOAuthClient) {
            const clientId = (0, get_env_var_1.getEnvVar)('GOOGLE_CLIENT_ID');
            if (!clientId) {
                throw new app_error_1.AppError({
                    errorMessageCode: app_error_1.ErrorMessageCode.INTERNAL_SERVER_ERROR,
                    httpCode: 500,
                });
            }
            this.googleOAuthClient = new google_auth_library_1.OAuth2Client(clientId);
        }
        return this.googleOAuthClient;
    }
    getGoogleOAuthConfig() {
        const clientId = (0, get_env_var_1.getEnvVar)('GOOGLE_CLIENT_ID');
        const clientSecret = (0, get_env_var_1.getEnvVar)('GOOGLE_CLIENT_SECRET');
        const backendUrl = (0, get_env_var_1.getEnvVar)('BACKEND_URL');
        const redirectUri = (0, get_env_var_1.getEnvVar)('GOOGLE_REDIRECT_URI') || `${backendUrl}/auth/callback/google`;
        if (!clientId || !clientSecret) {
            this.logger.error('Missing Google OAuth configuration', {
                operation: 'AuthService.getGoogleOAuthConfig',
            });
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.INTERNAL_SERVER_ERROR,
                httpCode: 500,
            });
        }
        return { clientId, clientSecret, redirectUri };
    }
    async exchangeGoogleCode(code, config) {
        try {
            const response = await axios_1.default.post('https://oauth2.googleapis.com/token', null, {
                params: {
                    code,
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    redirect_uri: config.redirectUri,
                    grant_type: 'authorization_code',
                },
            });
            if (!response.data?.id_token) {
                throw new app_error_1.AppError({
                    errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                    httpCode: 401,
                });
            }
            return response.data;
        }
        catch (error) {
            if (error instanceof app_error_1.AppError)
                throw error;
            this.logger.warn('Google token exchange failed', {
                operation: 'AuthService.exchangeGoogleCode',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
    }
}
exports.AuthService = AuthService;
