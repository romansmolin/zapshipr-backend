"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class XConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.appId = (0, get_env_var_1.getEnvVar)("X_APP_ID");
        this.appSecret = (0, get_env_var_1.getEnvVar)("X_APP_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("X_REDIRECT_URL");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
    }
    async connectXAccount(userId, code, codeVerifier) {
        try {
            const formData = new URLSearchParams({
                code,
                redirect_uri: `${this.backendUrl}${this.redirectUri}`,
                grant_type: "authorization_code",
                code_verifier: codeVerifier,
            });
            const credentials = Buffer.from(`${this.appId}:${this.appSecret}`).toString("base64");
            const tokenResponse = await this.httpClient.post("https://api.twitter.com/2/oauth2/token", formData.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${credentials}`,
                },
            });
            const accessToken = tokenResponse?.access_token;
            if (!accessToken) {
                throw new base_error_1.BaseAppError("Failed to retrieve X access token", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
            }
            const tokenExpiresIn = new Date(Date.now() + (tokenResponse.expires_in || 0) * 1000);
            const userInfoResponse = await this.httpClient.get("https://api.twitter.com/2/users/me", {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                    "user.fields": "id,username,name,profile_image_url",
                },
            });
            const user = userInfoResponse.data;
            if (!user || !user.id || !user.username) {
                throw new base_error_1.BaseAppError("X user info not found", error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, user.username || user.id, user.profile_image_url);
            const account = new account_1.Account((0, uuid_1.v4)(), userId, "x", user.name || user.username, accessToken, new Date(), user.id, accountImageUrl, tokenResponse.refresh_token, tokenExpiresIn);
            const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            this.logger.info("Successfully processed X account", {
                operation: "connect_x_account",
                entity: "Account",
                userId,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Failed to connect X account", {
                operation: "connect_x_account",
                entity: "Account",
                userId,
                error: error instanceof Error
                    ? {
                        name: error.name,
                        stack: error.stack,
                    }
                    : { name: "UnknownError" },
                axiosMessage: axios_1.default.isAxiosError(error)
                    ? error.response?.data?.error_description || error.message
                    : undefined,
            });
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status || 500;
                if (status === 400 || status === 401) {
                    throw new base_error_1.BaseAppError("Invalid X authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect X account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.XConnectorService = XConnectorService;
