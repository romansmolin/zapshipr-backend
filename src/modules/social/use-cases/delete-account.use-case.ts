import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { IUserService } from '@/modules/user/services/user.service.interface'
import type { IPostsService } from '@/modules/post/services/posts-service.interface'

export interface DeleteAccountInput {
    userId: string
    accountId: string
}

export interface DeleteAccountResult {
    success: boolean
}

export class DeleteAccountUseCase {
    private readonly repo: IAccountRepository
    private readonly logger: ILogger
    private readonly mediaUploader: IMediaUploader
    private readonly userService?: IUserService
    private readonly postsService?: IPostsService

    constructor(
        repo: IAccountRepository,
        logger: ILogger,
        mediaUploader: IMediaUploader,
        userService?: IUserService,
        postsService?: IPostsService
    ) {
        this.repo = repo
        this.logger = logger
        this.mediaUploader = mediaUploader
        this.userService = userService
        this.postsService = postsService
    }

    async execute({ userId, accountId }: DeleteAccountInput): Promise<DeleteAccountResult> {
        try {
            const account = await this.repo.getAccountById(userId, accountId)

            if (!account) {
                this.logger.warn('Account not found for deletion', {
                    operation: 'DeleteAccountUseCase.execute',
                    userId,
                    accountId,
                })
                return { success: false }
            }

            if (account.picture && this.isS3Url(account.picture)) {
                try {
                    await this.mediaUploader.delete(account.picture)
                } catch (error) {
                    this.logger.warn('Failed to delete account image from S3', {
                        operation: 'DeleteAccountUseCase.execute',
                        userId,
                        accountId,
                        error: {
                            name: error instanceof Error ? error.name : 'UnknownError',
                            stack: error instanceof Error ? error.stack : undefined,
                        },
                    })
                }
            }

            if (account.platform === SocilaMediaPlatform.PINTEREST) {
                try {
                    await this.repo.deletePinterestBoardsByAccountId(userId, accountId)
                } catch (error) {
                    this.logger.error('Failed to delete Pinterest boards', {
                        operation: 'DeleteAccountUseCase.execute',
                        userId,
                        accountId,
                        error: {
                            name: error instanceof Error ? error.name : 'UnknownError',
                            code: error instanceof BaseAppError ? error.code : ErrorCode.UNKNOWN_ERROR,
                            stack: error instanceof Error ? error.stack : undefined,
                        },
                    })
                }
            }

            if (this.postsService) {
                await this.postsService.deletePostsOrphanedByAccount(userId, accountId)
            }

            const success = await this.repo.deleteAccount(userId, accountId)

            if (success && this.userService) {
                await this.userService.decrementConnectedAccountsUsage(userId)
            }

            if (success) {
                this.logger.info('Successfully deleted account', {
                    operation: 'DeleteAccountUseCase.execute',
                    userId,
                    accountId,
                })
            } else {
                this.logger.warn('Account not found for deletion', {
                    operation: 'DeleteAccountUseCase.execute',
                    userId,
                    accountId,
                })
            }

            return { success }
        } catch (error) {
            if (error instanceof BaseAppError) throw error
            throw new BaseAppError('Failed to delete account', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    private isS3Url(url: string): boolean {
        try {
            const parsedUrl = new URL(url)
            const bucket = process.env.AWS_S3_BUCKET

            if (!bucket) {
                return parsedUrl.hostname.includes('amazonaws.com')
            }

            const normalizedHostname = parsedUrl.hostname.toLowerCase()
            return normalizedHostname === `${bucket}.s3.amazonaws.com` || normalizedHostname.startsWith(`${bucket}.s3.`)
        } catch {
            return false
        }
    }
}
