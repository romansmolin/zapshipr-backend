import { randomUUID } from 'crypto'
import path from 'path'
import bcrypt from 'bcryptjs'

import type { IUserRepository } from '../repositories/user-repository.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { PLAN_CRITICAL_THRESHOLD, PLAN_LIMITS, PLAN_WARNING_THRESHOLD } from '@/shared/consts/plan-limits.const'
import { UserPlans, normalizeUserPlan } from '@/shared/consts/plans'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IUserService, PlanWarning, UsageQuota, UserPlanSnapshot } from './user.service.interface'
import { IWorkspaceRepository } from '@/modules/workspace/repositories/workspace-repository.interface'
import { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import { IMediaRepository } from '@/modules/media/repositories/media-repository.interface'
import { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { schema as dbSchema } from '@/db/schema'
import { sql } from 'drizzle-orm'
import type { User } from '../entity/user.schema'
import type { UpdateUserSettingsInput } from '../validation/user.schemas'

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
        const plan = await this.getUserPlan(userId)

        let usage: UsageQuota | null = null
        let warnings: PlanWarning[] = []

        if (plan?.isActive) {
            usage = await this.getUsageQuota(userId)
            warnings = await this.getUsageWarnings(userId)
        }

        this.logger.info('User info retrieved', {
            operation: 'UserService.getUserInfo',
            userId,
            workspaceCount: userWorkspaces.length,
            planName: plan?.planName ?? null,
        })

        return {
            user,
            userWorkspaces,
            planName: plan?.planName ?? null,
            plan,
            usage,
            warnings,
        }
    }

    async getUsageQuota(userId: string): Promise<UsageQuota> {
        const plan = await this.requireUserPlan(userId)
        const normalizedPlan = normalizeUserPlan(plan.planName)
        const limits = PLAN_LIMITS[normalizedPlan]

        const [workspacesUsed, accounts, aiActionsUsed, postMediaUsage] = await Promise.all([
            this.workspaceRepository.countByUserId(userId),
            this.accountRepository.findByUserId(userId),
            this.getAiUsageCountForPlan(userId, plan),
            this.getPostMediaUsage(userId),
        ])

        return {
            workspaces: this.toQuotaMetric(workspacesUsed, limits.workspaceLimit),
            connectedAccounts: this.toQuotaMetric(accounts.length, limits.connectedAccountsLimit),
            aiActions: this.toQuotaMetric(aiActionsUsed, limits.aiActionsPerMonth),
            storageBytes: this.toQuotaMetric(postMediaUsage.storageBytes, limits.storageBytesLimit),
            files: this.toQuotaMetric(postMediaUsage.files, limits.filesLimit),
            maxFileSizeBytes: limits.maxFileSizeBytes,
        }
    }

    async getUserPlan(userId: string): Promise<UserPlanSnapshot | null> {
        const activePlan = await this.userRepository.findActivePlan(userId)

        if (!activePlan) {
            const lastPlan = await this.userRepository.findLastPlan(userId)

            if (!lastPlan) {
                return null
            }

            const normalizedPlanName = normalizeUserPlan(lastPlan.planName)
            return {
                id: lastPlan.id,
                planName: normalizedPlanName,
                billingStatus: 'inactive',
                isActive: false,
                periodStart: lastPlan.startDate,
                periodEnd: lastPlan.currentPeriodEnd ?? lastPlan.endDate,
                priceMonthlyEur: PLAN_LIMITS[normalizedPlanName].priceMonthlyEur,
                trialEndsAt: null,
                trialDaysRemaining: null,
                planType: lastPlan.planType,
            }
        }

        const normalizedPlanName = normalizeUserPlan(activePlan.planName)
        const billingStatus = activePlan.billingStatus ?? 'active'
        const trialEndsAt =
            billingStatus === 'trialing' ? (activePlan.currentPeriodEnd ?? activePlan.endDate) : null
        const trialDaysRemaining = trialEndsAt
            ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null

        return {
            id: activePlan.id,
            planName: normalizedPlanName,
            billingStatus,
            isActive: true,
            periodStart: activePlan.startDate,
            periodEnd: activePlan.currentPeriodEnd ?? activePlan.endDate,
            priceMonthlyEur: PLAN_LIMITS[normalizedPlanName].priceMonthlyEur,
            planType: activePlan.planType,
            trialEndsAt,
            trialDaysRemaining,
        }
    }

    async incrementAiUsage(userId: string): Promise<void> {
        const plan = await this.requireUserPlan(userId)
        const normalizedPlan = normalizeUserPlan(plan.planName)
        const limits = PLAN_LIMITS[normalizedPlan]
        const period = this.resolveUsagePeriod(plan)

        await this.db.transaction(async (tx) => {
            const existingUsageResult = await tx.execute(sql`
                SELECT id, used_count, limit_count
                FROM user_plan_usage
                WHERE user_id = ${userId}
                  AND plan_id = ${plan.id}
                  AND usage_type = 'ai'
                  AND period_start = ${period.start}
                  AND period_end = ${period.end}
                LIMIT 1
                FOR UPDATE
            `)

            const existingUsageRow = existingUsageResult.rows[0] as
                | { id: string; used_count: number | string; limit_count: number | string }
                | undefined

            let usageId = existingUsageRow?.id
            let usedCount = Number(existingUsageRow?.used_count ?? 0)
            let limitCount = Number(existingUsageRow?.limit_count ?? limits.aiActionsPerMonth)

            if (!usageId) {
                usageId = randomUUID()
                usedCount = 0
                limitCount = limits.aiActionsPerMonth

                await tx.execute(sql`
                    INSERT INTO user_plan_usage (
                        id,
                        user_id,
                        plan_id,
                        usage_type,
                        period_start,
                        period_end,
                        used_count,
                        limit_count,
                        created_at,
                        updated_at
                    ) VALUES (
                        ${usageId},
                        ${userId},
                        ${plan.id},
                        'ai',
                        ${period.start},
                        ${period.end},
                        0,
                        ${limitCount},
                        now(),
                        now()
                    )
                `)
            }

            if (usedCount >= limitCount) {
                throw new BaseAppError(
                    'AI actions limit reached for your current plan',
                    ErrorCode.PLAN_LIMIT_REACHED,
                    403
                )
            }

            await tx.execute(sql`
                UPDATE user_plan_usage
                SET used_count = used_count + 1,
                    updated_at = now()
                WHERE id = ${usageId}
            `)
        })
    }

    async getUsageWarnings(userId: string): Promise<PlanWarning[]> {
        const usage = await this.getUsageQuota(userId)
        const warnings: PlanWarning[] = []

        warnings.push(
            ...this.buildWarnings('workspaces', usage.workspaces.used, usage.workspaces.limit, 'Workspace limit')
        )
        warnings.push(
            ...this.buildWarnings(
                'connectedAccounts',
                usage.connectedAccounts.used,
                usage.connectedAccounts.limit,
                'Connected accounts limit'
            )
        )
        warnings.push(
            ...this.buildWarnings('aiActions', usage.aiActions.used, usage.aiActions.limit, 'AI actions limit')
        )
        warnings.push(
            ...this.buildWarnings(
                'storageBytes',
                usage.storageBytes.used,
                usage.storageBytes.limit,
                'Storage limit'
            )
        )
        warnings.push(...this.buildWarnings('files', usage.files.used, usage.files.limit, 'Files limit'))

        return warnings
    }

    async assertCanCreateWorkspace(userId: string): Promise<void> {
        const usage = await this.getUsageQuota(userId)
        if (usage.workspaces.used >= usage.workspaces.limit) {
            throw new BaseAppError(
                'Workspace limit reached for your current plan',
                ErrorCode.PLAN_LIMIT_REACHED,
                403
            )
        }
    }

    async assertCanConnectAccount(userId: string): Promise<void> {
        const usage = await this.getUsageQuota(userId)
        if (usage.connectedAccounts.used >= usage.connectedAccounts.limit) {
            throw new BaseAppError(
                'Connected accounts limit reached for your current plan',
                ErrorCode.PLAN_LIMIT_REACHED,
                403
            )
        }
    }

    async assertCanUpdateAiCustomInstructions(userId: string): Promise<void> {
        const plan = await this.requireUserPlan(userId)
        const normalizedPlan = normalizeUserPlan(plan.planName)

        if (normalizedPlan !== UserPlans.PRO) {
            throw new BaseAppError(
                'AI custom instructions are available only on the Pro plan',
                ErrorCode.PLAN_LIMIT_REACHED,
                403
            )
        }
    }

    async assertPostMediaUploadAllowed(userId: string, files: Array<{ sizeBytes: number }>): Promise<void> {
        if (files.length === 0) {
            return
        }

        const usage = await this.getUsageQuota(userId)
        const additionalFilesCount = files.length
        const additionalStorageBytes = files.reduce((sum, file) => sum + Math.max(0, file.sizeBytes), 0)

        const oversizeFile = files.find((file) => file.sizeBytes > usage.maxFileSizeBytes)
        if (oversizeFile) {
            throw new BaseAppError(
                `File size exceeds plan limit (${usage.maxFileSizeBytes} bytes)`,
                ErrorCode.PLAN_LIMIT_REACHED,
                403
            )
        }

        if (usage.files.used + additionalFilesCount > usage.files.limit) {
            throw new BaseAppError('Files limit reached for your current plan', ErrorCode.PLAN_LIMIT_REACHED, 403)
        }

        if (usage.storageBytes.used + additionalStorageBytes > usage.storageBytes.limit) {
            throw new BaseAppError(
                'Storage limit reached for your current plan',
                ErrorCode.PLAN_LIMIT_REACHED,
                403
            )
        }
    }

    private buildWarnings(key: PlanWarning['key'], used: number, limit: number, label: string): PlanWarning[] {
        if (limit <= 0) return []

        const ratio = used / limit
        if (ratio < PLAN_WARNING_THRESHOLD) return []

        return [
            {
                key,
                level: ratio >= PLAN_CRITICAL_THRESHOLD ? 'critical' : 'warning',
                used,
                limit,
                ratio,
                message: `${label} is ${(ratio * 100).toFixed(0)}% used`,
            },
        ]
    }

    private toQuotaMetric(used: number, limit: number) {
        return {
            used,
            limit,
            remaining: Math.max(0, limit - used),
        }
    }

    private resolveUsagePeriod(plan: UserPlanSnapshot): { start: Date; end: Date } {
        const now = new Date()

        if (plan.periodEnd && plan.periodEnd.getTime() > now.getTime() && plan.periodStart < plan.periodEnd) {
            return {
                start: plan.periodStart,
                end: plan.periodEnd,
            }
        }

        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
        return { start, end }
    }

    private async getAiUsageCountForPlan(userId: string, plan: UserPlanSnapshot): Promise<number> {
        const period = this.resolveUsagePeriod(plan)
        return this.userRepository.getAiUsageCount(userId, plan.id, period.start, period.end)
    }

    private async getPostMediaUsage(userId: string): Promise<{ files: number; storageBytes: number }> {
        return this.userRepository.getPostMediaUsage(userId)
    }

    private async requireUserPlan(userId: string): Promise<UserPlanSnapshot> {
        const plan = await this.getUserPlan(userId)
        if (!plan) {
            throw new BaseAppError('Unable to resolve user plan', ErrorCode.UNKNOWN_ERROR, 500)
        }

        return plan
    }

    async updateUserSettings(
        userId: string,
        data: UpdateUserSettingsInput,
        avatarFile?: Express.Multer.File
    ): Promise<User> {
        const user = await this.userRepository.findById(userId)

        if (!user) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
                httpCode: 404,
            })
        }

        let nextAvatar = user.avatar ?? null

        if (data.newPassword) {
            if (user.passwordHash) {
                if (!data.currentPassword) {
                    throw new AppError({
                        errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                        message: 'currentPassword is required',
                        httpCode: 400,
                    })
                }

                const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.passwordHash)

                if (!isCurrentPasswordValid) {
                    throw new AppError({
                        errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
                        httpCode: 401,
                    })
                }
            }

            const passwordHash = await bcrypt.hash(data.newPassword, 10)
            await this.userRepository.updateUserPassword(userId, passwordHash)
        }

        if (avatarFile) {
            if (!avatarFile.mimetype.startsWith('image/')) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                    message: 'Avatar must be an image',
                    httpCode: 400,
                })
            }

            const extension = path.extname(avatarFile.originalname) || '.jpg'
            const key = `${userId}/avatars/${Date.now()}${extension}`
            const uploadedAvatarUrl = await this.mediaUploader.upload({
                key,
                body: avatarFile.buffer,
                contentType: avatarFile.mimetype,
            })

            await this.mediaRepository.create({
                userId,
                key,
                url: uploadedAvatarUrl,
                size: avatarFile.size,
                contentType: avatarFile.mimetype,
                lastModified: new Date(),
            })

            nextAvatar = uploadedAvatarUrl
        } else if (data.removeAvatar === true) {
            nextAvatar = null
        }

        const previousAvatar = user.avatar
        const shouldDeletePreviousAvatar =
            !!previousAvatar && (data.removeAvatar === true || (avatarFile && nextAvatar !== previousAvatar))

        if (shouldDeletePreviousAvatar) {
            try {
                await this.mediaUploader.delete(previousAvatar)
                const previousAvatarKey = this.extractKeyFromUrl(previousAvatar)
                if (previousAvatarKey) {
                    await this.mediaRepository.deleteByKey(previousAvatarKey)
                }
            } catch (error) {
                this.logger.warn('Failed to delete previous user avatar', {
                    operation: 'UserService.updateUserSettings',
                    userId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        const hasProfileFields =
            data.name !== undefined || data.email !== undefined || nextAvatar !== (user.avatar ?? null)

        if (hasProfileFields) {
            const updatedUser = await this.userRepository.updateUserProfile(userId, {
                name: data.name?.trim(),
                email: data.email?.trim().toLowerCase(),
                avatar: nextAvatar,
            })

            return updatedUser
        }

        const updatedUser = await this.userRepository.findById(userId)

        if (!updatedUser) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
                httpCode: 404,
            })
        }

        return updatedUser
    }

    private extractKeyFromUrl(url: string): string | null {
        try {
            const key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''))
            return key || null
        } catch (_error) {
            return null
        }
    }

    async deleteUserAccout(userId: string): Promise<void> {
        this.logger.info('Deleting user account', {
            operation: 'UserService.deleteUserAccount',
            userId,
        })

        const user = await this.userRepository.findById(userId)

        if (user?.avatar) {
            try {
                await this.mediaUploader.delete(user.avatar)
                const avatarKey = this.extractKeyFromUrl(user.avatar)
                if (avatarKey) {
                    await this.mediaRepository.deleteByKey(avatarKey)
                }
            } catch (error) {
                this.logger.warn('Failed to delete user avatar from S3', {
                    operation: 'UserService.deleteUserAccount',
                    userId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

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
