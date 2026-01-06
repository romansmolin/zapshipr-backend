"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class TikTokConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.appId = (0, get_env_var_1.getEnvVar)("TIKTOK_APP_ID");
        this.appSecret = (0, get_env_var_1.getEnvVar)("TIKTOK_APP_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("TIKTOK_REDIRECT_URI");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
    }
    async connectTikTokAccount(userId, code) {
        try {
            const redirectUri = `${this.backendUrl}${this.redirectUri}`;
            const formData = new URLSearchParams({
                client_key: this.appId,
                client_secret: this.appSecret,
                redirect_uri: redirectUri,
                code,
                grant_type: "authorization_code",
            });
            const tokenResponse = await this.httpClient.post("https://open.tiktokapis.com/v2/oauth/token/", formData.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
            const accessToken = tokenResponse?.access_token;
            if (!accessToken) {
                throw new base_error_1.BaseAppError("Failed to retrieve TikTok access token", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
            }
            const { refresh_token, expires_in, refresh_expires_in } = tokenResponse;
            const refreshTokenExpiresIn = new Date(Date.now() + (refresh_expires_in || 0) * 1000);
            const tokenExpiresIn = new Date(Date.now() + (expires_in || 0) * 1000);
            const userInfoResponse = await this.httpClient.get("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const user = userInfoResponse.data?.user;
            if (!user) {
                throw new base_error_1.BaseAppError("TikTok user info not found", error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const userAvatar = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, user.display_name || user.open_id, user.avatar_url);
            const creatorInfo = await this.getCreatorPostingInfo(accessToken, userId);
            const account = new account_1.Account((0, uuid_1.v4)(), userId, userId, // workspaceId - temporarily use userId
            "tiktok", user.display_name, accessToken, new Date(), user.open_id, userAvatar, refresh_token, tokenExpiresIn, refreshTokenExpiresIn, creatorInfo.maxVideoPostDurationSec, creatorInfo.privacyLevelOptions);
            const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            this.logger.info("Successfully processed TikTok account", {
                operation: "connect_tiktok_account",
                entity: "Account",
                userId,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Failed to connect TikTok account", {
                operation: "connect_tiktok_account",
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
                    throw new base_error_1.BaseAppError("Invalid TikTok authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect TikTok account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async getCreatorPostingInfo(accessToken, userId) {
        const apiBaseUrl = (0, get_env_var_1.getEnvVar)("TIKTOK_API_URL");
        const apiVersion = (0, get_env_var_1.getEnvVar)("TIKTOK_API_VERSION");
        try {
            const response = await this.httpClient.post(`${apiBaseUrl}/${apiVersion}/post/publish/creator_info/query/`, {}, // TikTok expects an empty JSON body; avoid sending headers as body
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });
            const infoPayload = response?.data ??
                response?.creator_info ??
                response ??
                response?.data;
            const rawDuration = infoPayload?.max_video_post_duration_sec;
            const maxVideoPostDurationSec = typeof rawDuration === "number"
                ? rawDuration
                : typeof rawDuration === "string" && rawDuration
                    ? Number(rawDuration)
                    : null;
            const privacyLevelOptions = Array.isArray(infoPayload?.privacy_level_options)
                ? infoPayload.privacy_level_options
                : null;
            this.logger.debug("Fetched TikTok creator posting info", {
                operation: "get_creator_posting_info",
                userId,
                hasMaxDuration: typeof maxVideoPostDurationSec === "number",
                privacyOptionsCount: privacyLevelOptions?.length,
                rawKeys: infoPayload ? Object.keys(infoPayload) : [],
            });
            return {
                maxVideoPostDurationSec,
                privacyLevelOptions,
            };
        }
        catch (error) {
            throw new base_error_1.BaseAppError("Unable to retrieve TikTok creator settings. Please try connecting again.", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.TikTokConnectorService = TikTokConnectorService;
