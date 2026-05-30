import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { ErrorCode } from '@/shared/consts/error-codes.const'

import type { UsageQuota } from './user.service.interface'

jest.mock('../../use-cases/get-usage-quota.use-case', () => ({
    getUsageQuota: jest.fn(),
}))

import { getUsageQuota } from '../../use-cases/get-usage-quota.use-case'
import { assertCanCreateWorkspace } from '../../use-cases/assert-can-create-workspace.use-case'
import { assertCanConnectAccount } from '../../use-cases/assert-can-connect-account.use-case'
import { assertPostMediaUploadAllowed } from '../../use-cases/assert-post-media-upload-allowed.use-case'

const mockedGetUsageQuota = getUsageQuota as jest.MockedFunction<typeof getUsageQuota>

const baseQuota = (overrides: Partial<UsageQuota> = {}): UsageQuota => ({
    workspaces: { used: 0, limit: 1, remaining: 1 },
    connectedAccounts: { used: 0, limit: 3, remaining: 3 },
    aiActions: { used: 0, limit: 100, remaining: 100 },
    storageBytes: { used: 0, limit: 1024, remaining: 1024 },
    files: { used: 0, limit: 10, remaining: 10 },
    maxFileSizeBytes: 50,
    ...overrides,
})

const deps = {} as any

describe('plan quota guards', () => {
    beforeEach(() => {
        mockedGetUsageQuota.mockReset()
    })

    it('blocks workspace creation when workspace limit is reached', async () => {
        mockedGetUsageQuota.mockResolvedValue(baseQuota({ workspaces: { used: 1, limit: 1, remaining: 0 } }))

        await expect(assertCanCreateWorkspace(deps, 'user-1')).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })

    it('blocks account connection when account limit is reached', async () => {
        mockedGetUsageQuota.mockResolvedValue(
            baseQuota({ connectedAccounts: { used: 3, limit: 3, remaining: 0 } })
        )

        await expect(assertCanConnectAccount(deps, 'user-1')).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })

    it('blocks uploads larger than max file size', async () => {
        mockedGetUsageQuota.mockResolvedValue(
            baseQuota({
                storageBytes: { used: 10, limit: 1000, remaining: 990 },
                files: { used: 1, limit: 10, remaining: 9 },
                maxFileSizeBytes: 50,
            })
        )

        await expect(
            assertPostMediaUploadAllowed(deps, 'user-1', [{ sizeBytes: 51 }])
        ).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })

    it('blocks uploads when projected files exceed limit', async () => {
        mockedGetUsageQuota.mockResolvedValue(
            baseQuota({
                storageBytes: { used: 10, limit: 1000, remaining: 990 },
                files: { used: 10, limit: 10, remaining: 0 },
                maxFileSizeBytes: 50,
            })
        )

        await expect(
            assertPostMediaUploadAllowed(deps, 'user-1', [{ sizeBytes: 10 }])
        ).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })
})
