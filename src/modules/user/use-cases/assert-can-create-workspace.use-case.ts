import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import { getUsageQuota, type GetUsageQuotaDeps } from './get-usage-quota.use-case'

export type AssertCanCreateWorkspaceDeps = GetUsageQuotaDeps

export const assertCanCreateWorkspace = async (
    deps: AssertCanCreateWorkspaceDeps,
    userId: string
): Promise<void> => {
    const usage = await getUsageQuota(deps, userId)
    if (usage.workspaces.used >= usage.workspaces.limit) {
        throw new BaseAppError(
            'Workspace limit reached for your current plan',
            ErrorCode.PLAN_LIMIT_REACHED,
            403
        )
    }
}
