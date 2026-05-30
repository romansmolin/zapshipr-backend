import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { PLAN_LIMITS } from '@/shared/consts/plan-limits.const'
import { normalizeUserPlan } from '@/shared/consts/plans'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { IWorkspaceRepository } from '@/modules/workspace/repositories/workspace-repository.interface'

import type { IUserRepository } from '../repositories/user-repository.interface'
import type { UsageQuota } from '../services/user/user.service.interface'

import { getUserPlan } from './get-user-plan.use-case'
import { resolveUsagePeriod, toQuotaMetric } from './_helpers'

export type GetUsageQuotaDeps = {
    users: IUserRepository
    workspaces: IWorkspaceRepository
    accounts: IAccountRepository
}

export const getUsageQuota = async (deps: GetUsageQuotaDeps, userId: string): Promise<UsageQuota> => {
    const { users, workspaces, accounts } = deps

    const plan = await getUserPlan(deps, userId)
    if (!plan) {
        throw new BaseAppError('Unable to resolve user plan', ErrorCode.UNKNOWN_ERROR, 500)
    }

    const normalizedPlan = normalizeUserPlan(plan.planName)
    const limits = PLAN_LIMITS[normalizedPlan]
    const period = resolveUsagePeriod(plan)

    const [workspacesUsed, accountsList, aiActionsUsed, postMediaUsage] = await Promise.all([
        workspaces.countByUserId(userId),
        accounts.findByUserId(userId),
        users.getAiUsageCount(userId, plan.id, period.start, period.end),
        users.getPostMediaUsage(userId),
    ])

    return {
        workspaces: toQuotaMetric(workspacesUsed, limits.workspaceLimit),
        connectedAccounts: toQuotaMetric(accountsList.length, limits.connectedAccountsLimit),
        aiActions: toQuotaMetric(aiActionsUsed, limits.aiActionsPerMonth),
        storageBytes: toQuotaMetric(postMediaUsage.storageBytes, limits.storageBytesLimit),
        files: toQuotaMetric(postMediaUsage.files, limits.filesLimit),
        maxFileSizeBytes: limits.maxFileSizeBytes,
    }
}
