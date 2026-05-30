import { Workspace } from '@/modules/workspace/entity/workspace.schema'
import type { User } from '../../entity/user.schema'
import type { UpdateUserSettingsInput } from '../../validation/user.schemas'

export interface QuotaMetric {
    used: number
    limit: number
    remaining: number
}

export interface UsageQuota {
    workspaces: QuotaMetric
    connectedAccounts: QuotaMetric
    aiActions: QuotaMetric
    storageBytes: QuotaMetric
    files: QuotaMetric
    maxFileSizeBytes: number
}

export type PlanWarningKey = 'workspaces' | 'connectedAccounts' | 'aiActions' | 'storageBytes' | 'files'
export type PlanWarningLevel = 'warning' | 'critical'

export interface PlanWarning {
    key: PlanWarningKey
    level: PlanWarningLevel
    used: number
    limit: number
    ratio: number
    message: string
}

export interface UserPlanSnapshot {
    id: string
    planName: string
    billingStatus: string
    isActive: boolean
    periodStart: Date
    periodEnd: Date | null
    priceMonthlyEur: number
    trialEndsAt: Date | null
    trialDaysRemaining: number | null
    planType: 'yearly' | 'monthly'
}

export interface UserInfo {
    user: User
    planName: string | null
    plan: UserPlanSnapshot | null
    usage: UsageQuota | null
    warnings: PlanWarning[]
    userWorkspaces: Workspace[]
}

export interface IUserService {
    getUserInfo(userId: string): Promise<UserInfo>
    getUsageQuota(userId: string): Promise<UsageQuota>
    getUsageWarnings(userId: string): Promise<PlanWarning[]>
    getUserPlan(userId: string): Promise<UserPlanSnapshot | null>
    incrementAiUsage(userId: string): Promise<void>
    assertCanCreateWorkspace(userId: string): Promise<void>
    assertCanConnectAccount(userId: string): Promise<void>
    assertCanUpdateAiCustomInstructions(userId: string): Promise<void>
    assertPostMediaUploadAllowed(userId: string, files: Array<{ sizeBytes: number }>): Promise<void>
    updateUserSettings(
        userId: string,
        data: UpdateUserSettingsInput,
        avatarFile?: Express.Multer.File
    ): Promise<User>
    deleteUserAccount(userId: string): Promise<void>
}
