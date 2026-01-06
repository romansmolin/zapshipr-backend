"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvVar = void 0;
const getEnvVar = (key) => {
    return process.env[key] ?? '';
};
exports.getEnvVar = getEnvVar;
