"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatError = void 0;
const formatError = (error) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return { message: String(error) };
};
exports.formatError = formatError;
