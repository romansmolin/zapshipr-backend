"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorHandler = void 0;
const zod_1 = require("zod");
const app_error_1 = require("@/shared/errors/app-error");
const base_error_1 = require("@/shared/errors/base-error");
const forma_error_1 = require("@/shared/utils/forma-error");
const buildValidationFields = (error) => {
    return error.issues.map((issue) => ({
        field: issue.path.join('.') || 'form',
        errorMessageCode: issue.message || app_error_1.ErrorMessageCode.VALIDATION_ERROR,
    }));
};
const mapErrorToResponse = (error) => {
    if (error instanceof app_error_1.AppError) {
        return {
            errorMessageCode: error.errorMessageCode,
            httpCode: error.httpCode,
            fields: error.fields,
        };
    }
    if (error instanceof base_error_1.BaseAppError) {
        return {
            errorMessageCode: error.code,
            httpCode: error.httpCode,
        };
    }
    if (error instanceof zod_1.ZodError) {
        return {
            errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
            httpCode: 400,
            fields: buildValidationFields(error),
        };
    }
    return {
        errorMessageCode: app_error_1.ErrorMessageCode.INTERNAL_SERVER_ERROR,
        httpCode: 500,
    };
};
const createErrorHandler = (logger) => (error, req, res, next) => {
    if (res.headersSent)
        return next(error);
    const body = mapErrorToResponse(error);
    logger.error('Request failed', {
        operation: `${req.method} ${req.originalUrl}`,
        error: (0, forma_error_1.formatError)(error),
    });
    res.status(body.httpCode).json(body);
};
exports.createErrorHandler = createErrorHandler;
