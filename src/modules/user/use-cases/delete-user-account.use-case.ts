import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { IMediaRepository } from '@/modules/media/repositories/media-repository.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { IWorkspaceRepository } from '@/modules/workspace/repositories/workspace-repository.interface'

import type { IUserRepository } from '../repositories/user-repository.interface'

import { extractKeyFromUrl } from './_helpers'

export type DeleteUserAccountDeps = {
    users: IUserRepository
    workspaces: IWorkspaceRepository
    posts: IPostsRepository
    accounts: IAccountRepository
    media: IMediaRepository
    mediaUploader: IMediaUploader
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
}

export const deleteUserAccount = async (
    { users, workspaces, posts, accounts, media, mediaUploader, db, logger }: DeleteUserAccountDeps,
    userId: string
): Promise<void> => {
    logger.info('Deleting user account', {
        operation: 'deleteUserAccount',
        userId,
    })

    const user = await users.findById(userId)

    if (user?.avatar) {
        try {
            await mediaUploader.delete(user.avatar)
            const avatarKey = extractKeyFromUrl(user.avatar)
            if (avatarKey) {
                await media.deleteByKey(avatarKey)
            }
        } catch (error) {
            logger.warn('Failed to delete user avatar from S3', {
                operation: 'deleteUserAccount',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }
    }

    const userWorkspaces = await workspaces.findByUserId(userId)

    const deleteWorkspacePostsPromises = userWorkspaces.map((workspace) =>
        posts.deleteAllWorkspacePosts(userId, workspace.id)
    )

    const results = await Promise.allSettled(deleteWorkspacePostsPromises)

    const allMediaUrls: string[] = []

    results.forEach((result) => {
        if (result.status === 'fulfilled') {
            allMediaUrls.push(...result.value.mediaUrls)
        } else {
            logger.error('Failed to delete workspace posts', {
                operation: 'deleteUserAccount',
                userId,
                error: result.reason,
            })
        }
    })

    logger.info('Deleted all user posts', {
        operation: 'deleteUserAccount',
        userId,
        mediaUrlsCount: allMediaUrls.length,
    })

    if (allMediaUrls.length > 0) {
        const s3DeletePromises = allMediaUrls.map((url) => mediaUploader.delete(url))
        const s3Results = await Promise.allSettled(s3DeletePromises)

        s3Results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.error('Failed to delete media from S3', {
                    operation: 'deleteUserAccount',
                    userId,
                    url: allMediaUrls[index],
                    error: result.reason,
                })
            }
        })

        logger.info('Deleted all media from S3', {
            operation: 'deleteUserAccount',
            userId,
            deletedCount: s3Results.filter((r) => r.status === 'fulfilled').length,
            failedCount: s3Results.filter((r) => r.status === 'rejected').length,
        })
    }

    await media.deleteByUserId(userId)

    logger.info('Deleted user media records', {
        operation: 'deleteUserAccount',
        userId,
    })

    const userAccounts = await accounts.findByUserId(userId)
    const deleteAccountPromises = userAccounts.map((account) => accounts.deleteAccount(userId, account.id))
    await Promise.allSettled(deleteAccountPromises)

    logger.info('Deleted all user social accounts', {
        operation: 'deleteUserAccount',
        userId,
        accountsCount: userAccounts.length,
    })

    const deleteWorkspacePromises = userWorkspaces.map((workspace) => workspaces.delete(workspace.id))
    await Promise.allSettled(deleteWorkspacePromises)

    logger.info('Deleted all user workspaces', {
        operation: 'deleteUserAccount',
        userId,
        workspacesCount: userWorkspaces.length,
    })

    try {
        await db.execute(sql`DELETE FROM user_plans WHERE user_id = ${userId}`)
        logger.info('Deleted user plans and subscriptions', {
            operation: 'deleteUserAccount',
            userId,
        })
    } catch (error) {
        logger.warn('Failed to delete user plans (table may not exist)', {
            operation: 'deleteUserAccount',
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
        })
    }

    try {
        await db.execute(sql`DELETE FROM platform_daily_usage WHERE user_id = ${userId}`)
    } catch (error) {
        logger.warn('Failed to delete platform daily usage (table may not exist)', {
            operation: 'deleteUserAccount',
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
        })
    }

    try {
        await db.execute(sql`DELETE FROM user_plan_usage WHERE user_id = ${userId}`)
    } catch (error) {
        logger.warn('Failed to delete user plan usage (table may not exist)', {
            operation: 'deleteUserAccount',
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
        })
    }

    try {
        await db.execute(sql`DELETE FROM tenant_settings WHERE user_id = ${userId}`)
    } catch (error) {
        logger.warn('Failed to delete tenant settings (table may not exist)', {
            operation: 'deleteUserAccount',
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
        })
    }

    try {
        await db.execute(sql`DELETE FROM tiktok_publish_jobs WHERE user_id = ${userId}`)
    } catch (error) {
        logger.warn('Failed to delete TikTok publish jobs (table may not exist)', {
            operation: 'deleteUserAccount',
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
        })
    }

    logger.info('Completed deletion of user usage data, settings, and jobs', {
        operation: 'deleteUserAccount',
        userId,
    })

    await users.deleteById(userId)

    logger.info('User account and all related data deleted successfully', {
        operation: 'deleteUserAccount',
        userId,
    })
}
