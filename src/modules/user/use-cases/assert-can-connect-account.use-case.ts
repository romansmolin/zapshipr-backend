import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import { getUsageQuota, type GetUsageQuotaDeps } from './get-usage-quota.use-case'

export type AssertCanConnectAccountDeps = GetUsageQuotaDeps

export const assertCanConnectAccount = async (
    deps: AssertCanConnectAccountDeps,
    userId: string
): Promise<void> => {
    const usage = await getUsageQuota(deps, userId)
    if (usage.connectedAccounts.used >= usage.connectedAccounts.limit) {
        throw new BaseAppError(
            'Connected accounts limit reached for your current plan',
            ErrorCode.PLAN_LIMIT_REACHED,
            403
        )
    }
}
