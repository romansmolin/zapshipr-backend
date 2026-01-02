"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedinConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class LinkedinConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.clientId = (0, get_env_var_1.getEnvVar)("LINKEDIN_CLIENT_ID");
        this.clientSecret = (0, get_env_var_1.getEnvVar)("LINKEDIN_CLIENT_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("LINKEDIN_REDIRECT_URI");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
    }
    async connectLinkedinAccount(userId, code) {
        try {
            const formData = new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: `${this.backendUrl}${this.redirectUri}`,
                client_id: this.clientId,
                client_secret: this.clientSecret,
            });
            const tokenResponse = await this.httpClient.post("https://www.linkedin.com/oauth/v2/accessToken", formData.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            const accessToken = tokenResponse?.access_token;
            if (!accessToken) {
                throw new base_error_1.BaseAppError("Failed to retrieve LinkedIn access token", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
            }
            const profile = await this.httpClient.get("https://api.linkedin.com/v2/userinfo", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!profile || !profile.sub) {
                throw new base_error_1.BaseAppError("LinkedIn profile information not found", error_codes_const_1.ErrorCode.NOT_FOUND, 404);
            }
            const firstName = profile.given_name || profile.name?.split(" ")[0] || "LinkedIn";
            const lastName = profile.family_name || profile.name?.split(" ").slice(1).join(" ") || "User";
            const displayName = profile.name || `${firstName} ${lastName}`.trim() || "LinkedIn User";
            const profilePictureUrl = profile.picture || undefined;
            const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, displayName, profilePictureUrl);
            const tokenExpiresIn = new Date(Date.now() + (tokenResponse.expires_in || 0) * 1000);
            const refreshTokenExpiresIn = tokenResponse.refresh_token_expires_in
                ? new Date(Date.now() + tokenResponse.refresh_token_expires_in * 1000)
                : undefined;
            const account = new account_1.Account((0, uuid_1.v4)(), userId, "linkedin", displayName, accessToken, new Date(), profile.sub, accountImageUrl, tokenResponse.refresh_token, tokenExpiresIn, refreshTokenExpiresIn);
            const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            this.logger.info("Successfully processed LinkedIn account", {
                operation: "connect_linkedin_account",
                entity: "Account",
                userId,
                linkedinId: profile.sub,
                displayName,
                hasRefreshToken: !!tokenResponse.refresh_token,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Failed to connect LinkedIn account", {
                operation: "connect_linkedin_account",
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
                    throw new base_error_1.BaseAppError("Invalid LinkedIn authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect LinkedIn account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.LinkedinConnectorService = LinkedinConnectorService;
