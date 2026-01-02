"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueskyConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
class BlueskyConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.apiBaseUrl = (0, get_env_var_1.getEnvVar)('BLUESKY_API_BASE_URL') || (0, get_env_var_1.getEnvVar)('BLUESKY_OAUTH_BASE_URL');
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
    }
    async connectBlueskyAccount(userId, identifier, appPassword) {
        try {
            const session = await this.httpClient.post(`${this.apiBaseUrl}/xrpc/com.atproto.server.createSession`, {
                identifier,
                password: appPassword,
            });
            const { did, handle, accessJwt, refreshJwt } = session;
            if (!accessJwt || !did) {
                throw new base_error_1.BaseAppError('Failed to establish Bluesky session', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
            }
            let displayName;
            let avatarUrl;
            try {
                const profile = await this.httpClient.get(`${this.apiBaseUrl}/xrpc/app.bsky.actor.getProfile`, {
                    headers: {
                        Authorization: `Bearer ${accessJwt}`,
                    },
                    params: {
                        actor: did,
                    },
                });
                displayName = profile.displayName;
                avatarUrl = profile.avatar;
            }
            catch (profileError) {
                this.logger.warn('Failed to fetch Bluesky profile details', {
                    operation: 'connect_bluesky_account',
                    entity: 'Account',
                    userId,
                    did,
                    error: {
                        name: profileError instanceof Error ? profileError.name : 'Unknown',
                        stack: profileError instanceof Error ? profileError.stack : undefined,
                    },
                });
            }
            const accountName = displayName || handle || did;
            const accessTokenTtlMinutes = Number(process.env.BLUESKY_ACCESS_TOKEN_TTL_MINUTES || '55');
            const accessTokenExpiresAt = new Date(Date.now() + accessTokenTtlMinutes * 60 * 1000);
            const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, identifier, avatarUrl);
            const account = new account_1.Account((0, uuid_1.v4)(), userId, 'bluesky', accountName, accessJwt, new Date(), did, accountImageUrl, refreshJwt, accessTokenExpiresAt, undefined);
            const { isNew } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            this.logger.info('Successfully processed Bluesky account', {
                operation: 'connect_bluesky_account',
                entity: 'Account',
                userId,
                did,
                handle,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error('Failed to connect Bluesky account', {
                operation: 'connect_bluesky_account',
                entity: 'Account',
                userId,
                identifier,
                error: error instanceof Error
                    ? {
                        name: error.name,
                        stack: error.stack,
                    }
                    : { name: 'UnknownError' },
            });
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status || 500;
                if (status === 400 || status === 401) {
                    throw new base_error_1.BaseAppError('Invalid Bluesky credentials. Please verify your identifier and app password.', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError('Failed to connect Bluesky account', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.BlueskyConnectorService = BlueskyConnectorService;
