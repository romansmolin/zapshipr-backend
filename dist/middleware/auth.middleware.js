"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_error_1 = require("@/shared/errors/app-error");
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const tokenFromCookie = req.cookies?.token;
    const token = tokenFromHeader ?? tokenFromCookie;
    if (!token) {
        throw new app_error_1.AppError({ errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED, httpCode: 401 });
    }
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'change-me';
    let payload = null;
    // If token is from Authorization header, try to verify as access token first
    if (tokenFromHeader && accessSecret) {
        try {
            payload = jsonwebtoken_1.default.verify(token, accessSecret);
        }
        catch {
            // Not an access token, will try refresh token below
        }
    }
    // If not verified as access token (or from cookie), try refresh token
    if (!payload) {
        try {
            payload = jsonwebtoken_1.default.verify(token, refreshSecret);
        }
        catch (error) {
            throw new app_error_1.AppError({ errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED, httpCode: 401 });
        }
    }
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        throw new app_error_1.AppError({ errorMessageCode: app_error_1.ErrorMessageCode.UNAUTHORIZED, httpCode: 401 });
    }
    req.user = {
        id: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
    };
    next();
};
exports.authMiddleware = authMiddleware;
