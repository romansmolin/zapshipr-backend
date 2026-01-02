"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class InstagramConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.appId = (0, get_env_var_1.getEnvVar)("INSTAGRAM_APP_ID");
        this.appSecret = (0, get_env_var_1.getEnvVar)("INSTAGRAM_APP_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("INSTAGRAM_REDIRECT_URI");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
    }
    async connectInstagramAccount(userId, code) {
        try {
            const formData = new URLSearchParams({
                client_id: this.appId,
                client_secret: this.appSecret,
                redirect_uri: `${this.backendUrl}${this.redirectUri}`,
                grant_type: "authorization_code",
                code,
            });
            const tokenResponse = await this.httpClient.post("https://api.instagram.com/oauth/access_token", formData.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            const shortLivedToken = tokenResponse?.access_token;
            if (!shortLivedToken) {
                throw new base_error_1.BaseAppError("Failed to get short-lived Instagram access token", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const longLivedTokenResponse = await this.httpClient.get("https://graph.instagram.com/access_token", {
                params: {
                    grant_type: "ig_exchange_token",
                    client_secret: this.appSecret,
                    access_token: shortLivedToken,
                },
            });
            const longLivedToken = longLivedTokenResponse?.access_token;
            if (!longLivedToken) {
                throw new base_error_1.BaseAppError("Failed to get long-lived Instagram access token", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const accessTokenExpiresAt = new Date(Date.now() + (longLivedTokenResponse.expires_in || 0) * 1000);
            const accountInfoResponse = await this.httpClient.get("https://graph.instagram.com/v23.0/me", {
                params: {
                    fields: "id,username,profile_picture_url,user_id",
                    access_token: longLivedToken,
                },
            });
            if (!accountInfoResponse?.id) {
                throw new base_error_1.BaseAppError("Failed to fetch Instagram account details", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const instagramUserId = accountInfoResponse.user_id ?? accountInfoResponse.id;
            const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, accountInfoResponse.username || instagramUserId, accountInfoResponse.profile_picture_url);
            const account = new account_1.Account((0, uuid_1.v4)(), userId, "instagram", accountInfoResponse.username, longLivedToken, new Date(), instagramUserId, accountImageUrl, undefined, accessTokenExpiresAt);
            const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            this.logger.info("Successfully processed Instagram account", {
                operation: "connect_instagram_account",
                entity: "Account",
                userId,
                instagramUserId,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Failed to connect Instagram account", {
                operation: "connect_instagram_account",
                entity: "Account",
                userId,
                error: error instanceof Error
                    ? {
                        name: error.name,
                        stack: error.stack,
                    }
                    : { name: "UnknownError" },
                axiosMessage: axios_1.default.isAxiosError(error)
                    ? error.response?.data?.error?.message || error.message
                    : undefined,
            });
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status || 500;
                if (status === 400 || status === 401) {
                    throw new base_error_1.BaseAppError("Invalid Instagram authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect Instagram account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.InstagramConnectorService = InstagramConnectorService;
