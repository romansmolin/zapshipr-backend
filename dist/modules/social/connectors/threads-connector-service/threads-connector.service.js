"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadsConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class ThreadsConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.appId = (0, get_env_var_1.getEnvVar)("THREADS_APP_ID");
        this.appSecret = (0, get_env_var_1.getEnvVar)("THREADS_APP_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("THREADS_REDIRECT_URI");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
    }
    async connectThreadsAccount(userId, code) {
        try {
            const redirectUri = `${this.backendUrl}${this.redirectUri}`;
            const oauthParams = {
                client_id: this.appId,
                client_secret: this.appSecret,
                redirect_uri: redirectUri,
                code,
            };
            const tokenResponse = await this.httpClient.get("https://graph.threads.net/oauth/access_token", { params: oauthParams });
            const shortLiveToken = tokenResponse?.access_token;
            if (!shortLiveToken) {
                throw new base_error_1.BaseAppError("Failed to retrieve Threads access token", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
            }
            const profile = await this.httpClient.get("https://graph.threads.net/v1.0/me", {
                params: {
                    fields: "id,username,name,threads_profile_picture_url,threads_biography",
                    access_token: shortLiveToken,
                },
            });
            const tokenExchangeResponse = await this.httpClient.get("https://graph.threads.net/access_token", {
                params: {
                    grant_type: "th_exchange_token",
                    client_secret: this.appSecret,
                    access_token: shortLiveToken,
                },
            });
            const longLiveAccessToken = tokenExchangeResponse?.access_token;
            if (!longLiveAccessToken) {
                throw new base_error_1.BaseAppError("Failed to exchange Threads token", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const tokenExpiresIn = new Date(Date.now() + (tokenExchangeResponse.expires_in || 0) * 1000);
            if (!profile || !profile.id || !profile.username) {
                throw new base_error_1.BaseAppError("Threads profile information not found", error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, profile.username || profile.id, profile.threads_profile_picture_url);
            const account = new account_1.Account((0, uuid_1.v4)(), userId.toString(), "threads", profile.username, longLiveAccessToken, new Date(), profile.id, accountImageUrl, undefined, tokenExpiresIn);
            const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            this.logger.info("Successfully processed Threads account", {
                operation: "connect_threads_account",
                entity: "Account",
                userId,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Failed to connect Threads account", {
                operation: "connect_threads_account",
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
                    throw new base_error_1.BaseAppError("Invalid Threads authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect Threads account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.ThreadsConnectorService = ThreadsConnectorService;
