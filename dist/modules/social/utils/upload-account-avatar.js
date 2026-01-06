"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAccountAvatar = void 0;
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const axios_1 = __importDefault(require("axios"));
const getprofileImageAsBuffer = async (imageUrl, accessToken) => {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    };
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }
    const response = await axios_1.default.get(imageUrl, {
        responseType: 'arraybuffer',
        headers,
    });
    const buffer = Buffer.from(response.data, 'binary');
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    return { buffer, contentType };
};
const sanitizeIdentifier = (identifier) => {
    if (!identifier)
        return 'avatar';
    const sanitized = identifier.trim().replace(/[^a-zA-Z0-9-_]/g, '_');
    return sanitized.length > 0 ? sanitized : 'avatar';
};
const uploadAccountAvatar = async (mediaUploader, userId, identifier, imageUrl, accessToken, contentTypeOverride) => {
    try {
        if (!imageUrl)
            return undefined;
        const { buffer, contentType } = await getprofileImageAsBuffer(imageUrl, accessToken);
        const safeIdentifier = sanitizeIdentifier(identifier);
        return mediaUploader.upload({
            key: `${userId}/accounts/${Date.now()}-${safeIdentifier}`,
            body: buffer,
            contentType: contentTypeOverride || contentType,
        });
    }
    catch (err) {
        throw new base_error_1.BaseAppError('Failed to upload account avatar', error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
    }
};
exports.uploadAccountAvatar = uploadAccountAvatar;
