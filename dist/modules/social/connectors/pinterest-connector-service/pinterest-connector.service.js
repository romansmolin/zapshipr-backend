"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinterestConnectorService = void 0;
const account_1 = require("@/modules/social/entity/account");
const pinterest_board_1 = require("@/modules/social/entity/pinterest-board");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const get_env_var_1 = require("@/shared/utils/get-env-var");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const upload_account_avatar_1 = require("../../utils/upload-account-avatar");
const upsert_account_1 = require("../../utils/upsert-account");
const qs_1 = __importDefault(require("qs"));
const normalizeBoardPrivacy = (privacy) => {
    const value = (privacy ?? "PUBLIC").toUpperCase();
    if (value === "SECRET" || value === "PROTECTED") {
        return value;
    }
    return "PUBLIC";
};
class PinterestConnectorService {
    constructor(logger, httpClient, mediaUploader, accountRepository, accountService) {
        this.logger = logger;
        this.httpClient = httpClient;
        this.mediaUploader = mediaUploader;
        this.accountRepository = accountRepository;
        this.accountService = accountService;
        this.appId = (0, get_env_var_1.getEnvVar)("PINTEREST_APP_ID");
        this.appSecret = (0, get_env_var_1.getEnvVar)("PINTEREST_APP_SECRET");
        this.redirectUri = (0, get_env_var_1.getEnvVar)("PINTEREST_REDIRECT_URL");
        this.backendUrl = (0, get_env_var_1.getEnvVar)("BACKEND_URL");
        this.apiBaseUrl = (0, get_env_var_1.getEnvVar)("PINTEREST_API_URL");
        this.apiVersion = (0, get_env_var_1.getEnvVar)("PINTEREST_API_VERSION");
    }
    async connectPinterestAccount(userId, code) {
        try {
            const tokenBody = qs_1.default.stringify({
                grant_type: "authorization_code",
                code,
                redirect_uri: `${this.backendUrl}${this.redirectUri}`,
                continuous_refresh: true,
            });
            const tokenResponse = await this.httpClient.post(`${this.apiBaseUrl}/${this.apiVersion}/oauth/token`, tokenBody, {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            const accessToken = tokenResponse?.access_token;
            if (!accessToken) {
                throw new base_error_1.BaseAppError("Failed to retrieve Pinterest access token", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const profileResponse = await this.httpClient.get(`${this.apiBaseUrl}/${this.apiVersion}/user_account`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!profileResponse?.id) {
                throw new base_error_1.BaseAppError("Failed to fetch Pinterest account details", error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
            }
            const boardsResponse = await this.httpClient.get(`${this.apiBaseUrl}/${this.apiVersion}/boards`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!boardsResponse) {
                throw new base_error_1.BaseAppError("Failed to get boards from Pinterest", error_codes_const_1.ErrorCode.BAD_REQUEST, 404);
            }
            const accountImageUrl = await (0, upload_account_avatar_1.uploadAccountAvatar)(this.mediaUploader, userId, profileResponse.username || profileResponse.id, profileResponse.profile_image, accessToken);
            const account = new account_1.Account((0, uuid_1.v4)(), userId, userId, // workspaceId - temporarily use userId
            "pinterest", profileResponse.username, accessToken, new Date(), profileResponse.id, accountImageUrl, tokenResponse.refresh_token);
            const { isNew, account: persistedAccount } = await (0, upsert_account_1.upsertAccount)(account, this.accountRepository, this.accountService);
            if (boardsResponse.items && boardsResponse.items.length > 0) {
                await Promise.all(boardsResponse.items
                    .map((board) => ({ board, privacy: normalizeBoardPrivacy(board.privacy) }))
                    .filter(({ privacy }) => privacy !== "SECRET")
                    .map(async ({ board, privacy }) => {
                    try {
                        const pinterestBoard = new pinterest_board_1.PinterestBoard((0, uuid_1.v4)(), userId, persistedAccount.id, board.id, board.name, board.description || null, board.owner?.username || null, board.media?.image_cover_url || null, privacy, new Date(), new Date());
                        await this.accountRepository.savePinterestBoard(pinterestBoard);
                    }
                    catch (boardError) {
                        this.logger.warn("Failed to save Pinterest board", {
                            operation: "connect_pinterest_account",
                            entity: "PinterestBoard",
                            userId,
                            boardId: board.id,
                            error: {
                                name: boardError instanceof Error ? boardError.name : "Unknown",
                                stack: boardError instanceof Error ? boardError.stack : undefined,
                            },
                        });
                    }
                }));
            }
            this.logger.info("Successfully processed Pinterest account", {
                operation: "connect_pinterest_account",
                entity: "Account",
                userId,
                pinterestUserId: profileResponse.id,
                wasCreated: isNew,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error("Failed to connect Pinterest account", {
                operation: "connect_pinterest_account",
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
                    throw new base_error_1.BaseAppError("Invalid Pinterest authorization code. Please try connecting again.", error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
                }
            }
            if (error instanceof base_error_1.BaseAppError) {
                throw error;
            }
            throw new base_error_1.BaseAppError("Failed to connect Pinterest account", error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.PinterestConnectorService = PinterestConnectorService;
