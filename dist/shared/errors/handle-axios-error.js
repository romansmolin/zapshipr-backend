"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAxiosErrors = void 0;
const handleAxiosErrors = (error, logger) => {
    logger.error('Axios request failed', {
        operation: 'handleAxiosErrors',
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        response: error.response?.data,
        message: error.message,
    });
};
exports.handleAxiosErrors = handleAxiosErrors;
