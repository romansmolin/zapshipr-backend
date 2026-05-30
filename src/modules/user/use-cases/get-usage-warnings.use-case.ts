import type { PlanWarning } from '../services/user/user.service.interface'

import { getUsageQuota, type GetUsageQuotaDeps } from './get-usage-quota.use-case'
import { buildWarnings } from './_helpers'

export type GetUsageWarningsDeps = GetUsageQuotaDeps

export const getUsageWarnings = async (
    deps: GetUsageWarningsDeps,
    userId: string
): Promise<PlanWarning[]> => {
    const usage = await getUsageQuota(deps, userId)

    return [
        ...buildWarnings('workspaces', usage.workspaces.used, usage.workspaces.limit, 'Workspace limit'),
        ...buildWarnings(
            'connectedAccounts',
            usage.connectedAccounts.used,
            usage.connectedAccounts.limit,
            'Connected accounts limit'
        ),
        ...buildWarnings('aiActions', usage.aiActions.used, usage.aiActions.limit, 'AI actions limit'),
        ...buildWarnings('storageBytes', usage.storageBytes.used, usage.storageBytes.limit, 'Storage limit'),
        ...buildWarnings('files', usage.files.used, usage.files.limit, 'Files limit'),
    ]
}
