"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class FacebookConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.appId = (0, get_env_var_1.getEnvVar)("FB_APP_ID");
        this.appSecret = (0, get_env_var_1.getEnvVar)("FB_APP_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("FB_REDIRECT_URI");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
    }
    async connectFacebookAccount(userId, code) {
        try {
            const accessTokenResponse = await this.httpClient.get("https://graph.facebook.com/v18.0/oauth/access_token", {
                params: {
                    client_id: this.appId,
                    client_secret: this.appSecret,
                    redirect_uri: `${this.backendUrl}${this.redirectUri}`,
                    code,
                },
            });
            const accessToken = accessTokenResponse?.access_token;
            if (!accessToken) {
                throw new base_error_1.BaseAppError("Failed to retrieve Facebook user access token", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const pagesResponse = await this.httpClient.get("https://graph.facebook.com/v18.0/me/accounts", {
                params: {
                    access_token: accessToken,
                    fields: "id,name,access_token,picture,expires_in",
                },
            });
            const pages = pagesResponse?.data || [];
            if (pages.length === 0) {
                throw new base_error_1.BaseAppError("No Facebook pages available", error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const updatedPages = [];
            const otherErrors = [];
            let createdCount = 0;
            for (const page of pages) {
                try {
                    const profileImageUrl = page.picture?.data?.url;
                    const FACEBOOK_TOKEN_EXPIRY_SECONDS = 5183944;
                    const tokenExpiresAt = new Date(Date.now() + FACEBOOK_TOKEN_EXPIRY_SECONDS * 1000);
                    const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, page.name || page.id || "facebook-page", profileImageUrl);
                    const longLiveAccessToken = await this.httpClient.get("https://graph.facebook.com/v18.0/oauth/access_token", {
                        params: {
                            client_id: this.appId,
                            client_secret: this.appSecret,
                            fb_exchange_token: page.access_token,
                            grant_type: "fb_exchange_token",
                        },
                    });
                    if (!longLiveAccessToken?.access_token) {
                        throw new base_error_1.BaseAppError("Failed to exchange Facebook page token", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                    }
                    const account = new account_1.Account((0, uuid_1.v4)(), userId.toString(), "facebook", page.name, longLiveAccessToken.access_token, new Date(), page.id, accountImageUrl, undefined, tokenExpiresAt);
                    const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
                    if (isNew) {
                        createdCount++;
                    }
                    else {
                        updatedPages.push(page.name);
                    }
                }
                catch (pageError) {
                    otherErrors.push(pageError?.message || "Unknown error");
                }
            }
            if (createdCount === 0 && updatedPages.length === 0) {
                this.logger.warn("Failed to connect any Facebook pages", {
                    operation: "connect_facebook_account",
                    entity: "Account",
                    userId,
                    updatedPages,
                    otherErrors,
                });
                return { success: false };
            }
            this.logger.info("Processed Facebook page connections", {
                operation: "connect_facebook_account",
                entity: "Account",
                userId,
                createdCount,
                updatedCount: updatedPages.length,
                errorCount: otherErrors.length,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Error during Facebook account connection", {
                operation: "connect_facebook_account",
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
                errorMessage: error instanceof Error ? error.message : undefined,
            });
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status || 500;
                if (status === 400 || status === 401) {
                    throw new base_error_1.BaseAppError("Invalid Facebook authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect Facebook account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.FacebookConnectorService = FacebookConnectorService;
