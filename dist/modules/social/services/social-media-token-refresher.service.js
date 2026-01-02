"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMediaTokenRefresherService = void 0;
const axios_1 = __importStar(require("axios"));
const qs_1 = __importDefault(require("qs"));
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const handle_axios_error_1 = require("@/shared/errors/handle-axios-error");
class SocialMediaTokenRefresherService {
    constructor(logger, accountRepository) {
        this.logger = logger;
        this.accountRepository = accountRepository;
    }
    async updateAccessToken(accountId, platform, accessToken, refreshToken) {
        switch (platform) {
            case 'bluesky':
                await this.updateBlueskyAccessToken(accountId, refreshToken);
                break;
            case 'tiktok':
                await this.updateTikTokAccessToken(accountId, accessToken, refreshToken || '');
                break;
            case 'threads':
                await this.updateThreadsAccessToken(accountId, accessToken);
                break;
            case 'x':
                await this.updateXAccessToken(accountId, accessToken, refreshToken || '');
                break;
            case 'instagram':
                await this.updateInstagramAccessToken(accountId, accessToken);
                break;
            case 'facebook':
                await this.updateFacebookAccessToken(accountId, accessToken);
                break;
            case 'pinterest':
                await this.updatePinterestAccessToken(accountId, accessToken, refreshToken || '');
                break;
            case 'youtube':
                await this.updateYouTubeAccessToken(accountId, accessToken, refreshToken || '');
                break;
        }
    }
    async updateBlueskyAccessToken(accountId, refreshToken) {
        if (!refreshToken) {
            throw new base_error_1.BaseAppError('Missing Bluesky refresh token', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
        const apiBaseUrl = process.env.BLUESKY_API_BASE_URL || process.env.BLUESKY_OAUTH_BASE_URL || 'https://bsky.social';
        try {
            const response = await axios_1.default.post(`${apiBaseUrl}/xrpc/com.atproto.server.refreshSession`, undefined, {
                headers: {
                    Authorization: `Bearer ${refreshToken}`,
                },
            });
            const { accessJwt, refreshJwt } = response.data || {};
            if (!accessJwt) {
                throw new base_error_1.BaseAppError('Failed to refresh Bluesky session', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
            }
            const accessTokenTtlMinutes = Number(process.env.BLUESKY_ACCESS_TOKEN_TTL_MINUTES || '55');
            const accessTokenExpiresAt = new Date(Date.now() + accessTokenTtlMinutes * 60 * 1000);
            await this.accountRepository.updateAccessTokenByAccountId(accountId, accessTokenExpiresAt, accessJwt, refreshJwt || refreshToken, null);
            this.logger.info('Bluesky token refreshed successfully', {
                operation: 'update_bluesky_access_token',
                entity: 'Account',
                accountId,
                receivedNewRefreshToken: !!refreshJwt,
            });
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for Bluesky account', {
                blueskyAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError(`Failed to update access token for Bluesky account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async updateThreadsAccessToken(accountId, accessToken) {
        try {
            const { data } = await axios_1.default.get('https://graph.threads.net/refresh_access_token', {
                params: {
                    grant_type: 'th_refresh_token',
                    access_token: accessToken,
                },
            });
            const longLiveAccessToken = data.access_token;
            const tokenExpiresIn = new Date(Date.now() + data.expires_in * 1000);
            await this.accountRepository.updateAccessTokenByAccountId(accountId, tokenExpiresIn, longLiveAccessToken, data.refresh_token || '', null);
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for Threads account', {
                threadsAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            throw new base_error_1.BaseAppError(`Failed to update access token for Threads account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async updateInstagramAccessToken(accountId, accessToken) {
        try {
            const { data } = await axios_1.default.get('https://graph.instagram.com/refresh_access_token', {
                params: {
                    grant_type: 'ig_refresh_token',
                    access_token: accessToken,
                },
            });
            const longLiveAccessToken = data.access_token;
            const tokenExpiresIn = new Date(Date.now() + data.expires_in * 1000);
            await this.accountRepository.updateAccessTokenByAccountId(accountId, tokenExpiresIn, longLiveAccessToken, data.refresh_token || '', null);
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for Instagram account', {
                instagramAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            throw new base_error_1.BaseAppError(`Failed to update access token for Instagram account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async updatePinterestAccessToken(accountId, accessToken, refreshToken) {
        try {
            const { PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_REDIRECT_URL, PINTEREST_API_URL, PINTEREST_API_VERSION, } = process.env;
            if (!PINTEREST_APP_ID ||
                !PINTEREST_APP_SECRET ||
                !PINTEREST_REDIRECT_URL ||
                !PINTEREST_API_URL ||
                !PINTEREST_API_VERSION) {
                throw new base_error_1.BaseAppError('Missing Pinterest environment variables', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const formData = qs_1.default.stringify({
                grant_type: 'refresh_token',
                redirect_uri: `${process.env.BACKEND_URL}${PINTEREST_REDIRECT_URL}`,
                continuous_refresh: true,
                refresh_token: refreshToken,
            });
            // Create Basic Auth header with client credentials
            const credentials = Buffer.from(`${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`).toString('base64');
            const { data } = await axios_1.default.post(`${PINTEREST_API_URL}/${PINTEREST_API_VERSION}/oauth/token`, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${credentials}`,
                },
            });
            const { access_token, refresh_token, refresh_token_expires_in, refresh_token_expires_at, expires_in } = data;
            const tokenExpiresIn = new Date(Date.now() + expires_in * 1000);
            const refreshTokenExpiresIn = new Date(Date.now() + refresh_token_expires_in * 1000);
            await this.accountRepository.updateAccessTokenByAccountId(accountId, tokenExpiresIn, access_token, refresh_token, refreshTokenExpiresIn);
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for Pinterest account', {
                pinterestAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            throw new base_error_1.BaseAppError(`Failed to update access token for Pinterest account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async updateTikTokAccessToken(accountId, accessToken, refreshToken) {
        try {
            const { TIKTOK_APP_ID, TIKTOK_APP_SECRET } = process.env;
            if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET) {
                throw new base_error_1.BaseAppError('Missing TikTok environment variables', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const formData = qs_1.default.stringify({
                client_key: TIKTOK_APP_ID,
                client_secret: TIKTOK_APP_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            });
            const { data } = await axios_1.default.post('https://open.tiktokapis.com/v2/oauth/token/', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            this.logger.debug('NEW TIKTOK TOKEN: ', { data });
            const { access_token, refresh_token, expires_in, refresh_expires_in } = data;
            const refreshTokenExpiresIn = new Date(Date.now() + refresh_expires_in * 1000);
            const tokenExpiresIn = new Date(Date.now() + expires_in * 1000);
            await this.accountRepository.updateAccessTokenByAccountId(accountId, tokenExpiresIn, access_token, refresh_token, refreshTokenExpiresIn);
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for Instagram account', {
                tikTokAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            throw new base_error_1.BaseAppError(`Failed to update access token for TikTok account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async updateYouTubeAccessToken(accountId, accessToken, refreshToken) {
        try {
            const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
            if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
                throw new base_error_1.BaseAppError('Missing YouTube environment variables', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const formData = qs_1.default.stringify({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            });
            const { data } = await axios_1.default.post('https://oauth2.googleapis.com/token', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            const { access_token, refresh_token, expires_in, refresh_token_expires_in } = data;
            const tokenExpiresIn = new Date(Date.now() + expires_in * 1000);
            const refreshTokenExpiresIn = new Date(Date.now() + refresh_token_expires_in * 1000);
            await this.accountRepository.updateAccessTokenByAccountId(accountId, tokenExpiresIn, access_token, refresh_token, refreshTokenExpiresIn);
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for YouTube account', {
                threadsAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            throw new base_error_1.BaseAppError(`Failed to update access token for YouTube account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async updateXAccessToken(accountId, accessToken, refreshToken) {
        try {
            const { X_APP_ID, X_APP_SECRET } = process.env;
            if (!X_APP_ID || !X_APP_SECRET) {
                throw new base_error_1.BaseAppError('Missing X environment variables', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const formData = qs_1.default.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: X_APP_ID,
            });
            const credentials = Buffer.from(`${X_APP_ID}:${X_APP_SECRET}`).toString('base64');
            const { data } = await axios_1.default.post('https://api.twitter.com/2/oauth2/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${credentials}`,
                },
            });
            const { access_token, refresh_token, expires_in } = data;
            const tokenExpiresIn = new Date(Date.now() + expires_in * 1000);
            this.logger.info('NEW X ACCESS TOKEN: ', { token: access_token });
            await this.accountRepository.updateAccessTokenByAccountId(accountId, tokenExpiresIn, access_token, refresh_token, null);
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for X account', {
                xAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            throw new base_error_1.BaseAppError(`Failed to update access token for X account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async updateFacebookAccessToken(accountId, accessToken) {
        try {
            const { FB_APP_ID, FB_APP_SECRET } = process.env;
            if (!FB_APP_ID || !FB_APP_SECRET) {
                throw new base_error_1.BaseAppError('Missing Facebook environment variables', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const { data } = await axios_1.default.get('https://graph.facebook.com/v18.0/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: FB_APP_ID,
                    client_secret: FB_APP_SECRET,
                    fb_exchange_token: accessToken,
                },
            });
            const FACEBOOK_TOKEN_EXPIRY_SECONDS = 5183944;
            const tokenExpiresIn = new Date(Date.now() + FACEBOOK_TOKEN_EXPIRY_SECONDS * 1000);
            const { access_token } = data;
            await this.accountRepository.updateAccessTokenByAccountId(accountId, tokenExpiresIn, access_token, '', // Facebook doesn't use refresh tokens
            null);
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                (0, handle_axios_error_1.handleAxiosErrors)(error, this.logger);
            }
            this.logger.error('Error while updating access token for Facebook account', {
                facebookAccountId: accountId,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    stack: error instanceof Error ? error.stack : undefined,
                    code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                },
            });
            throw new base_error_1.BaseAppError(`Failed to update access token for Facebook account with ${accountId}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
        }
    }
    async findExpiringAccessTokensAndUpdate() {
        try {
            const { accountsSnapshots } = await this.accountRepository.findAccountsWithExpiringAccessTokens();
            if (accountsSnapshots.length === 0) {
                this.logger.info('No need to update any social account');
                return { accountIds: [] };
            }
            const results = await Promise.allSettled(accountsSnapshots.map((account) => this.updateAccessToken(account.id, account.platform, account.accessToken, account.refreshToken ?? undefined)));
            const failures = results.filter((result) => result.status === 'rejected');
            if (failures.length > 0) {
                const errorDetails = failures.map((failure, index) => ({
                    accountId: accountsSnapshots[index]?.id,
                    platform: accountsSnapshots[index]?.platform,
                    reason: failure.reason instanceof Error
                        ? failure.reason.message
                        : typeof failure.reason === 'object' && 'message' in failure.reason
                            ? failure.reason.message
                            : String(failure.reason),
                }));
                this.logger.error('Errors while updating access tokens', {
                    failures: errorDetails,
                });
                throw new base_error_1.BaseAppError(`Failed to update tokens for ${failures.length} account(s)`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
            }
            return { accountIds: [] };
        }
        catch (error) {
            this.logger.error('Failed to find and update', {
                operation: 'findExpiringAccessTokensAndUpdate',
                entity: 'Account',
                error: {
                    name: error instanceof Error ? error.name : 'Unknown',
                    code: error instanceof base_error_1.BaseAppError ? error.code : 'UNKNOWN',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw error;
        }
    }
}
exports.SocialMediaTokenRefresherService = SocialMediaTokenRefresherService;
