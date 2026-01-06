"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.ErrorMessageCode = void 0;
var ErrorMessageCode;
(function (ErrorMessageCode) {
    ErrorMessageCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorMessageCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorMessageCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorMessageCode["USER_ALREADY_EXISTS"] = "USER_ALREADY_EXISTS";
    ErrorMessageCode["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    ErrorMessageCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorMessageCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
    ErrorMessageCode["WORKSPACE_SLUG_EXISTS"] = "WORKSPACE_SLUG_EXISTS";
    ErrorMessageCode["SOCIAL_ACCOUNT_ALREADY_EXISTS"] = "SOCIAL_ACCOUNT_ALREADY_EXISTS";
    ErrorMessageCode["SOCIAL_ACCOUNT_NOT_FOUND"] = "SOCIAL_ACCOUNT_NOT_FOUND";
    ErrorMessageCode["DUPLICATE_INSPIRATION"] = "DUPLICATE_INSPIRATION";
    ErrorMessageCode["INSPIRATION_NOT_FOUND"] = "INSPIRATION_NOT_FOUND";
})(ErrorMessageCode || (exports.ErrorMessageCode = ErrorMessageCode = {}));
class AppError extends Error {
    constructor(params) {
        super(params.message ?? params.errorMessageCode);
        this.name = 'AppError';
        this.httpCode = params.httpCode;
        this.errorMessageCode = params.errorMessageCode;
        this.fields = params.fields;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
