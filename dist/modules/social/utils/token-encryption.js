"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptNullableToken = exports.encryptNullableToken = exports.decryptToken = exports.encryptToken = void 0;
const crypto_1 = require("crypto");
const app_error_1 = require("@/shared/errors/app-error");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TOKEN_PART_SEPARATOR = '.';
const getEncryptionKey = () => {
    const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    if (!secret) {
        throw new app_error_1.AppError({
            errorMessageCode: app_error_1.ErrorMessageCode.INTERNAL_SERVER_ERROR,
            httpCode: 500,
        });
    }
    return (0, crypto_1.createHash)('sha256').update(secret).digest();
};
const encryptToken = (value) => {
    const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(TOKEN_PART_SEPARATOR);
};
exports.encryptToken = encryptToken;
const decryptToken = (value) => {
    const parts = value.split(TOKEN_PART_SEPARATOR);
    // If token doesn't have 3 parts (iv.tag.encrypted), assume it's plaintext (legacy data)
    if (parts.length !== 3) {
        return value;
    }
    const [ivBase64, tagBase64, encryptedBase64] = parts;
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
        // If any part is missing, assume it's plaintext (legacy data)
        return value;
    }
    try {
        const iv = Buffer.from(ivBase64, 'base64');
        const tag = Buffer.from(tagBase64, 'base64');
        const encrypted = Buffer.from(encryptedBase64, 'base64');
        const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, getEncryptionKey(), iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    }
    catch (error) {
        // If decryption fails, assume it's plaintext (legacy data)
        return value;
    }
};
exports.decryptToken = decryptToken;
const encryptNullableToken = (value) => {
    return value ? (0, exports.encryptToken)(value) : null;
};
exports.encryptNullableToken = encryptNullableToken;
const decryptNullableToken = (value) => {
    if (!value) {
        return null;
    }
    return (0, exports.decryptToken)(value);
};
exports.decryptNullableToken = decryptNullableToken;
