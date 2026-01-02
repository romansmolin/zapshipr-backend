"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAppError = void 0;
class BaseAppError extends Error {
    constructor(message, code, httpCode) {
        super(message);
        this.name = 'BaseAppError';
        this.code = code;
        this.httpCode = httpCode;
        Object.setPrototypeOf(this, BaseAppError.prototype);
    }
}
exports.BaseAppError = BaseAppError;
