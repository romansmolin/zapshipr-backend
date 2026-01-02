"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const user_dto_1 = require("@/modules/user/entity/user.dto");
const app_error_1 = require("@/shared/errors/app-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const auth_schemas_1 = require("../validation/auth.schemas");
class AuthController {
    constructor(authService, logger) {
        this.logger = logger;
        this.authService = authService;
    }
    async signIn(req, res, next) {
        const payload = auth_schemas_1.signInSchema.parse(req.body);
        const result = await this.authService.signIn(payload);
        this.setAuthCookie(res, result.refreshToken);
        this.logger.info('User signed in', { operation: 'AuthController.signIn', userId: result.user.id });
        res.json({ user: this.toSafeUser(result.user), accessToken: result.accessToken });
    }
    async signUp(req, res, next) {
        const payload = auth_schemas_1.signUpSchema.parse(req.body);
        const result = await this.authService.signUp(payload);
        this.setAuthCookie(res, result.refreshToken);
        this.logger.info('User signed up', { operation: 'AuthController.signUp', userId: result.user.id });
        res.status(201).json({ user: this.toSafeUser(result.user), accessToken: result.accessToken });
    }
    async forgetPassword(req, res, next) {
        await this.authService.forgetPassword();
        res.status(204).end();
    }
    async changePassword(req, res, next) {
        await this.authService.changePassword();
        res.status(204).end();
    }
    async googleCallback(req, res, next) {
        const error = req.query?.error;
        const errorValue = Array.isArray(error) ? error[0] : error;
        if (typeof errorValue === 'string' && errorValue.trim() !== '') {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED,
                httpCode: 401,
            });
        }
        const payload = auth_schemas_1.googleCallbackSchema.parse(req.query);
        const result = await this.authService.googleCallback(payload.code);
        this.setAuthCookie(res, result.refreshToken);
        this.logger.info('Google auth callback handled', {
            operation: 'AuthController.googleCallback',
            userId: result.user.id,
        });
        const frontendUrl = (0, get_env_var_1.getEnvVar)('FRONTEND_URL');
        const redirectUrl = `${frontendUrl}/all-posts?userId=${result.user.id}`;
        this.logger.info('Redirecting to frontend', {
            operation: 'AuthController.googleCallback',
            redirectUrl: `${frontendUrl}/all-posts?userId=${result.user.id}`,
        });
        res.redirect(redirectUrl);
    }
    async authMe(req, res, next) {
        const refreshToken = req.cookies?.token;
        const result = await this.authService.getSession(refreshToken);
        this.setAuthCookie(res, result.refreshToken);
        this.logger.info('Session validated via cookie', {
            operation: 'AuthController.authMe',
            userId: result.user.id,
        });
        res.json({ user: this.toSafeUser(result.user), accessToken: result.accessToken });
    }
    async authRefresh(req, res, next) {
        const refreshToken = req.cookies?.token;
        const result = await this.authService.refresh(refreshToken);
        this.setAuthCookie(res, result.refreshToken);
        this.logger.info('Access token refreshed', {
            operation: 'AuthController.authRefresh',
        });
        res.json({ accessToken: result.accessToken });
    }
    async logout(req, res, next) {
        await this.authService.logout();
        this.clearAuthCookie(res);
        res.status(204).end();
    }
    toSafeUser(user) {
        return (0, user_dto_1.toUserResponse)(user);
    }
    // AUTH COOKIES LOGIC
    getRefreshCookieOptions() {
        return {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        };
    }
    setAuthCookie(res, refreshToken) {
        res.cookie('token', refreshToken, this.getRefreshCookieOptions());
    }
    clearAuthCookie(res) {
        const { maxAge, ...options } = this.getRefreshCookieOptions();
        res.clearCookie('token', options);
    }
}
exports.AuthController = AuthController;
