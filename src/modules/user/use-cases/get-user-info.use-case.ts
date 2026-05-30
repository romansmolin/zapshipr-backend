import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { IWorkspaceRepository } from '@/modules/workspace/repositories/workspace-repository.interface'

import type { IUserRepository } from '../repositories/user-repository.interface'
import type { PlanWarning, UsageQuota, UserInfo } from '../services/user/user.service.interface'

import { getUserPlan } from './get-user-plan.use-case'
import { getUsageQuota } from './get-usage-quota.use-case'
import { getUsageWarnings } from './get-usage-warnings.use-case'

export type GetUserInfoDeps = {
    users: IUserRepository
    workspaces: IWorkspaceRepository
    accounts: IAccountRepository
    logger: ILogger
}

export const getUserInfo = async (deps: GetUserInfoDeps, userId: string): Promise<UserInfo> => {
    const { users, workspaces, logger } = deps

    const user = await users.findById(userId)

    if (!user) {
        logger.warn('User not found', { operation: 'getUserInfo', userId })
        throw new AppError({
            errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
            httpCode: 404,
        })
    }

    const userWorkspaces = await workspaces.findByUserId(userId)
    const plan = await getUserPlan(deps, userId)

    let usage: UsageQuota | null = null
    let warnings: PlanWarning[] = []

    if (plan?.isActive) {
        usage = await getUsageQuota(deps, userId)
        warnings = await getUsageWarnings(deps, userId)
    }

    logger.info('User info retrieved', {
        operation: 'getUserInfo',
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
