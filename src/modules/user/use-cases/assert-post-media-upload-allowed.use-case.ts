import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import { getUsageQuota, type GetUsageQuotaDeps } from './get-usage-quota.use-case'

export type AssertPostMediaUploadAllowedDeps = GetUsageQuotaDeps

export const assertPostMediaUploadAllowed = async (
    deps: AssertPostMediaUploadAllowedDeps,
    userId: string,
    files: Array<{ sizeBytes: number }>
): Promise<void> => {
    if (files.length === 0) return

    const usage = await getUsageQuota(deps, userId)
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
