"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class YouTubeConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.clientId = (0, get_env_var_1.getEnvVar)("GOOGLE_CLIENT_ID");
        this.clientSecret = (0, get_env_var_1.getEnvVar)("GOOGLE_CLIENT_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("YOUTUBE_REDIRECT_URI");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
    }
    async connectYouTubeAccount(userId, code) {
        try {
            const formData = new URLSearchParams({
                code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: `${this.backendUrl}${this.redirectUri}`,
                grant_type: "authorization_code",
            });
            const tokenResponse = await this.httpClient.post("https://oauth2.googleapis.com/token", formData.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
            const { access_token: accessToken, refresh_token: refreshToken, expires_in, refresh_token_expires_in, } = tokenResponse;
            if (!accessToken) {
                throw new base_error_1.BaseAppError("Failed to retrieve YouTube access token", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
            }
            const userInfoResponse = await this.httpClient.get("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const channel = userInfoResponse.items?.[0];
            if (!channel) {
                throw new base_error_1.BaseAppError("YouTube channel info not found", error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const tokenExpiresIn = new Date(Date.now() + (expires_in || 0) * 1000);
            const refreshTokenExpiresIn = new Date(Date.now() + (refresh_token_expires_in || 0) * 1000);
            const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, channel.snippet.title || channel.id, channel.snippet.thumbnails?.default?.url);
            const account = new account_1.Account((0, uuid_1.v4)(), userId, userId, // workspaceId - temporarily use userId
            "youtube", channel.snippet.title, accessToken, new Date(), channel.id, accountImageUrl, refreshToken, tokenExpiresIn, refreshTokenExpiresIn);
            const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            this.logger.info("Successfully processed YouTube account", {
                operation: "connect_youtube_account",
                entity: "Account",
                userId,
                channelId: channel.id,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Failed to connect YouTube account", {
                operation: "connect_youtube_account",
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
                    throw new base_error_1.BaseAppError("Invalid YouTube authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect YouTube account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.YouTubeConnectorService = YouTubeConnectorService;
