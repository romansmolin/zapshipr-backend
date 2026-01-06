"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteAccountUseCase = void 0;
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
class DeleteAccountUseCase {
    constructor(repo, logger, mediaUploader, userService, postsService) {
        this.repo = repo;
        this.logger = logger;
        this.mediaUploader = mediaUploader;
        this.userService = userService;
        this.postsService = postsService;
    }
    async execute({ userId, accountId }) {
        try {
            const account = await this.repo.getAccountById(userId, accountId);
            if (!account) {
                this.logger.warn('Account not found for deletion', {
                    operation: 'DeleteAccountUseCase.execute',
                    userId,
                    accountId,
                });
                return { success: false };
            }
            if (account.picture && this.isS3Url(account.picture)) {
                try {
                    await this.mediaUploader.delete(account.picture);
                }
                catch (error) {
                    this.logger.warn('Failed to delete account image from S3', {
                        operation: 'DeleteAccountUseCase.execute',
                        userId,
                        accountId,
                        error: {
                            name: error instanceof Error ? error.name : 'UnknownError',
                            stack: error instanceof Error ? error.stack : undefined,
                        },
                    });
                }
            }
            if (account.platform === posts_schemas_1.SocilaMediaPlatform.PINTEREST) {
                try {
                    await this.repo.deletePinterestBoardsByAccountId(userId, accountId);
                }
                catch (error) {
                    this.logger.error('Failed to delete Pinterest boards', {
                        operation: 'DeleteAccountUseCase.execute',
                        userId,
                        accountId,
                        error: {
                            name: error instanceof Error ? error.name : 'UnknownError',
                            code: error instanceof base_error_1.BaseAppError ? error.code : error_codes_const_1.ErrorCode.UNKNOWN_ERROR,
                            stack: error instanceof Error ? error.stack : undefined,
                        },
                    });
                }
            }
            if (this.postsService) {
                await this.postsService.deletePostsOrphanedByAccount(userId, accountId);
            }
            const success = await this.repo.deleteAccount(userId, accountId);
            if (success && this.userService) {
                await this.userService.decrementConnectedAccountsUsage(userId);
            }
            if (success) {
                this.logger.info('Successfully deleted account', {
                    operation: 'DeleteAccountUseCase.execute',
                    userId,
                    accountId,
                });
            }
            else {
                this.logger.warn('Account not found for deletion', {
                    operation: 'DeleteAccountUseCase.execute',
                    userId,
                    accountId,
                });
            }
            return { success };
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError)
                throw error;
            throw new base_error_1.BaseAppError('Failed to delete account', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    isS3Url(url) {
        try {
            const parsedUrl = new URL(url);
            const bucket = process.env.AWS_S3_BUCKET;
            if (!bucket) {
                return parsedUrl.hostname.includes('amazonaws.com');
            }
            const normalizedHostname = parsedUrl.hostname.toLowerCase();
            return normalizedHostname === `${bucket}.s3.amazonaws.com` || normalizedHostname.startsWith(`${bucket}.s3.`);
        }
        catch {
            return false;
        }
    }
}
exports.DeleteAccountUseCase = DeleteAccountUseCase;
