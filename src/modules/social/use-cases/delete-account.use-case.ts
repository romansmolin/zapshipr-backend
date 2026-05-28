import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { IPostsService } from '@/modules/post/services/posts-service.interface'

export interface DeleteAccountInput {
    userId: string
    workspaceId: string
    accountId: string
}

export interface DeleteAccountResult {
    success: boolean
}

export type DeleteAccountDeps = {
    accounts: IAccountRepository
    mediaUploader: IMediaUploader
    postsService: IPostsService
    logger: ILogger
}

const isS3Url = (url: string): boolean => {
    try {
        const parsedUrl = new URL(url)
        const hostname = parsedUrl.hostname.toLowerCase()
        const pathname = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, '')
        const bucket = process.env.AWS_S3_BUCKET?.trim().toLowerCase()

        if (!bucket) {
            return hostname.includes('amazonaws.com')
        }

        if (hostname === `${bucket}.s3.amazonaws.com` || hostname.startsWith(`${bucket}.s3.`)) {
            return true
        }

        if (hostname === 's3.amazonaws.com' || hostname.startsWith('s3.')) {
            return pathname.startsWith(`${bucket}/`)
        }

        return false
    } catch {
        return false
    }
}

export const deleteAccount = async (
    { accounts, mediaUploader, postsService, logger }: DeleteAccountDeps,
    { userId, workspaceId, accountId }: DeleteAccountInput
): Promise<DeleteAccountResult> => {
    try {
        const account = await accounts.getAccountById(userId, accountId)

        if (!account) {
            logger.warn('Account not found for deletion', {
                operation: 'deleteAccount',
                userId,
                workspaceId,
                accountId,
            })
            return { success: false }
        }

        if (account.picture && isS3Url(account.picture)) {
            try {
                await mediaUploader.delete(account.picture)
            } catch (error) {
                logger.warn('Failed to delete account image from S3', {
                    operation: 'deleteAccount',
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
                await accounts.deletePinterestBoardsByAccountId(userId, accountId)
            } catch (error) {
                logger.error('Failed to delete Pinterest boards', {
                    operation: 'deleteAccount',
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

        await postsService.deletePostsOrphanedByAccount(userId, accountId)

        const success = await accounts.deleteAccount(userId, accountId)

        if (success) {
            logger.info('Successfully deleted account', {
                operation: 'deleteAccount',
                userId,
                accountId,
            })
        } else {
            logger.warn('Account not found for deletion', {
                operation: 'deleteAccount',
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
