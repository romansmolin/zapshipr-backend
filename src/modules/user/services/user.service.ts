import type { IUserRepository } from '../repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IUserService, UsageQuota, UserPlanSnapshot } from './user.service.interface'
import { IWorkspaceRepository } from '@/modules/workspace/repositories/workspace-repository.interface'
import { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import { IMediaRepository } from '@/modules/media/repositories/media-repository.interface'
import { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { schema as dbSchema } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export class UserService implements IUserService {
    private readonly userRepository: IUserRepository
    private readonly workspaceRepository: IWorkspaceRepository
    private readonly postsRepository: IPostsRepository
    private readonly accountRepository: IAccountRepository
    private readonly mediaRepository: IMediaRepository
    private readonly mediaUploader: IMediaUploader
    private readonly db: NodePgDatabase<typeof dbSchema>

    private readonly logger: ILogger

    constructor(
        userRepository: IUserRepository,
        workspaceRepository: IWorkspaceRepository,
        postsRepository: IPostsRepository,
        accountRepository: IAccountRepository,
        mediaRepository: IMediaRepository,
        mediaUploader: IMediaUploader,
        db: NodePgDatabase<typeof dbSchema>,
        logger: ILogger
    ) {
        this.userRepository = userRepository
        this.workspaceRepository = workspaceRepository
        this.postsRepository = postsRepository
        this.accountRepository = accountRepository
        this.mediaRepository = mediaRepository
        this.mediaUploader = mediaUploader
        this.db = db
        this.logger = logger
    }

    async getUserInfo(userId: string) {
        const user = await this.userRepository.findById(userId)

        if (!user) {
            this.logger.warn('User not found', {
                operation: 'UserService.getUserInfo',
                userId,
            })
            throw new AppError({
                errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
                httpCode: 404,
            })
        }

        const userWorkspaces = await this.workspaceRepository.findByUserId(userId)

        this.logger.info('User info retrieved', {
            operation: 'UserService.getUserInfo',
            userId,
            userWorkspaces,
        })

        return {
            user,
            userWorkspaces,
            planName: null,
        }
    }

    async getUsageQuota(userId: string): Promise<UsageQuota> {
        // TODO: Implement usage quota logic
        throw new Error('Not implemented')
    }

    async incrementConnectedAccountsUsage(userId: string): Promise<void> {
        // TODO: Implement increment logic
        throw new Error('Not implemented')
    }

    async decrementConnectedAccountsUsage(userId: string): Promise<void> {
        // TODO: Implement decrement logic
        throw new Error('Not implemented')
    }

    async getUserPlan(userId: string): Promise<UserPlanSnapshot | null> {
        // TODO: Implement get user plan logic
        throw new Error('Not implemented')
    }

    async incrementAiUsage(userId: string): Promise<void> {
        // TODO: Implement increment AI usage logic
        throw new Error('Not implemented')
    }

    async deleteUserAccout(userId: string): Promise<void> {
        this.logger.info('Deleting user account', {
            operation: 'UserService.deleteUserAccount',
            userId,
        })

        const userWorkspaces = await this.workspaceRepository.findByUserId(userId)

        const deleteWorkspacePostsPromises = userWorkspaces.map((workspace) =>
            this.postsRepository.deleteAllWorkspacePosts(userId, workspace.id)
        )

        const results = await Promise.allSettled(deleteWorkspacePostsPromises)

        const allMediaUrls: string[] = []

        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                allMediaUrls.push(...result.value.mediaUrls)
            } else {
                this.logger.error('Failed to delete workspace posts', {
                    operation: 'UserService.deleteUserAccount',
                    userId,
                    error: result.reason,
                })
            }
        })

        this.logger.info('Deleted all user posts', {
            operation: 'UserService.deleteUserAccount',
            userId,
            mediaUrlsCount: allMediaUrls.length,
        })

        // Delete all media from S3
        if (allMediaUrls.length > 0) {
            const s3DeletePromises = allMediaUrls.map((url) => this.mediaUploader.delete(url))
            const s3Results = await Promise.allSettled(s3DeletePromises)

            s3Results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    this.logger.error('Failed to delete media from S3', {
                        operation: 'UserService.deleteUserAccount',
                        userId,
                        url: allMediaUrls[index],
                        error: result.reason,
                    })
                }
            })

            this.logger.info('Deleted all media from S3', {
                operation: 'UserService.deleteUserAccount',
                userId,
                deletedCount: s3Results.filter((r) => r.status === 'fulfilled').length,
                failedCount: s3Results.filter((r) => r.status === 'rejected').length,
            })
        }

        // Delete all user media records from database
        await this.mediaRepository.deleteByUserId(userId)

        this.logger.info('Deleted user media records', {
            operation: 'UserService.deleteUserAccount',
            userId,
        })

        // Delete all social accounts
        const userAccounts = await this.accountRepository.findByUserId(userId)
        const deleteAccountPromises = userAccounts.map((account) =>
            this.accountRepository.deleteAccount(userId, account.id)
        )
        await Promise.allSettled(deleteAccountPromises)

        this.logger.info('Deleted all user social accounts', {
            operation: 'UserService.deleteUserAccount',
            userId,
            accountsCount: userAccounts.length,
        })

        // Delete all workspaces (cascade will handle related data: raw_inspirations, inspirations_extractions, workspace_tags, transcripts)
        const deleteWorkspacePromises = userWorkspaces.map((workspace) =>
            this.workspaceRepository.delete(workspace.id)
        )
        await Promise.allSettled(deleteWorkspacePromises)

        this.logger.info('Deleted all user workspaces', {
            operation: 'UserService.deleteUserAccount',
            userId,
            workspacesCount: userWorkspaces.length,
        })

        // Delete user plans and subscriptions (includes Stripe subscription data)
        try {
            await this.db.execute(sql`DELETE FROM user_plans WHERE user_id = ${userId}`)
            this.logger.info('Deleted user plans and subscriptions', {
                operation: 'UserService.deleteUserAccount',
                userId,
            })
        } catch (error) {
            this.logger.warn('Failed to delete user plans (table may not exist)', {
                operation: 'UserService.deleteUserAccount',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }

        // Delete platform daily usage
        try {
            await this.db.execute(sql`DELETE FROM platform_daily_usage WHERE user_id = ${userId}`)
        } catch (error) {
            this.logger.warn('Failed to delete platform daily usage (table may not exist)', {
                operation: 'UserService.deleteUserAccount',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }

        // Delete user plan usage
        try {
            await this.db.execute(sql`DELETE FROM user_plan_usage WHERE user_id = ${userId}`)
        } catch (error) {
            this.logger.warn('Failed to delete user plan usage (table may not exist)', {
                operation: 'UserService.deleteUserAccount',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }

        // Delete tenant settings
        try {
            await this.db.execute(sql`DELETE FROM tenant_settings WHERE user_id = ${userId}`)
        } catch (error) {
            this.logger.warn('Failed to delete tenant settings (table may not exist)', {
                operation: 'UserService.deleteUserAccount',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }

        // Delete TikTok publish jobs
        try {
            await this.db.execute(sql`DELETE FROM tiktok_publish_jobs WHERE user_id = ${userId}`)
        } catch (error) {
            this.logger.warn('Failed to delete TikTok publish jobs (table may not exist)', {
                operation: 'UserService.deleteUserAccount',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }

        this.logger.info('Completed deletion of user usage data, settings, and jobs', {
            operation: 'UserService.deleteUserAccount',
            userId,
        })

        // Finally, delete the user (cascade will handle password_reset_tokens)
        await this.userRepository.deleteById(userId)

        this.logger.info('User account and all related data deleted successfully', {
            operation: 'UserService.deleteUserAccount',
            userId,
        })
    }
}
