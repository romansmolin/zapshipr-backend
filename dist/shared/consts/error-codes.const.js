"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["PLAN_LIMIT_REACHED"] = "PLAN_LIMIT_REACHED";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["CONTENT_VALIDATION_FAILED"] = "CONTENT_VALIDATION_FAILED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
