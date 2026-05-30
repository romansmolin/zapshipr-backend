import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { IWorkspaceRepository } from '@/modules/workspace/repositories/workspace-repository.interface'
import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { IMediaRepository } from '@/modules/media/repositories/media-repository.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

import { UserService } from './user.service'
import type { UsageQuota } from './user.service.interface'

describe('UserService plan quota guards', () => {
    let service: UserService

    beforeEach(() => {
        const userRepository = {
            createUser: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByStripeCustomerId: jest.fn(),
            updateUserProfile: jest.fn(),
            updateRefreshToken: jest.fn(),
            updateUserPassword: jest.fn(),
            deleteById: jest.fn(),
        } as unknown as IUserRepository

        const workspaceRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByIdAndUserId: jest.fn(),
            findByUserId: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            updateMainPrompt: jest.fn(),
            updateOnboarding: jest.fn(),
            findDefaultByUserId: jest.fn(),
            countByUserId: jest.fn(),
            setAsDefault: jest.fn(),
        } as unknown as IWorkspaceRepository

        const postsRepository = {
            deleteAllWorkspacePosts: jest.fn(),
        } as unknown as IPostsRepository

        const accountRepository = {
            findByUserId: jest.fn(),
            deleteAccount: jest.fn(),
        } as unknown as IAccountRepository

        const mediaRepository = {
            deleteByUserId: jest.fn(),
            create: jest.fn(),
            deleteByKey: jest.fn(),
        } as unknown as IMediaRepository

        const mediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
            listObjects: jest.fn(),
            getSignedUrl: jest.fn(),
            getPresignedUploadUrl: jest.fn(),
        } as unknown as IMediaUploader

        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as unknown as ILogger

        service = new UserService(
            userRepository,
            workspaceRepository,
            postsRepository,
            accountRepository,
            mediaRepository,
            mediaUploader,
            { execute: jest.fn(), transaction: jest.fn() } as any,
            logger
        )
    })

    it('blocks workspace creation when workspace limit is reached', async () => {
        const quota: UsageQuota = {
            workspaces: { used: 1, limit: 1, remaining: 0 },
            connectedAccounts: { used: 0, limit: 3, remaining: 3 },
            aiActions: { used: 0, limit: 100, remaining: 100 },
            storageBytes: { used: 0, limit: 1024, remaining: 1024 },
            files: { used: 0, limit: 10, remaining: 10 },
            maxFileSizeBytes: 50,
        }
        jest.spyOn(service, 'getUsageQuota').mockResolvedValue(quota)

        await expect(service.assertCanCreateWorkspace('user-1')).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })

    it('blocks account connection when account limit is reached', async () => {
        const quota: UsageQuota = {
            workspaces: { used: 0, limit: 1, remaining: 1 },
            connectedAccounts: { used: 3, limit: 3, remaining: 0 },
            aiActions: { used: 0, limit: 100, remaining: 100 },
            storageBytes: { used: 0, limit: 1024, remaining: 1024 },
            files: { used: 0, limit: 10, remaining: 10 },
            maxFileSizeBytes: 50,
        }
        jest.spyOn(service, 'getUsageQuota').mockResolvedValue(quota)

        await expect(service.assertCanConnectAccount('user-1')).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })

    it('blocks uploads larger than max file size', async () => {
        const quota: UsageQuota = {
            workspaces: { used: 0, limit: 1, remaining: 1 },
            connectedAccounts: { used: 0, limit: 3, remaining: 3 },
            aiActions: { used: 0, limit: 100, remaining: 100 },
            storageBytes: { used: 10, limit: 1000, remaining: 990 },
            files: { used: 1, limit: 10, remaining: 9 },
            maxFileSizeBytes: 50,
        }
        jest.spyOn(service, 'getUsageQuota').mockResolvedValue(quota)

        await expect(
            service.assertPostMediaUploadAllowed('user-1', [{ sizeBytes: 51 }])
        ).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })

    it('blocks uploads when projected files exceed limit', async () => {
        const quota: UsageQuota = {
            workspaces: { used: 0, limit: 1, remaining: 1 },
            connectedAccounts: { used: 0, limit: 3, remaining: 3 },
            aiActions: { used: 0, limit: 100, remaining: 100 },
            storageBytes: { used: 10, limit: 1000, remaining: 990 },
            files: { used: 10, limit: 10, remaining: 0 },
            maxFileSizeBytes: 50,
        }
        jest.spyOn(service, 'getUsageQuota').mockResolvedValue(quota)

        await expect(
            service.assertPostMediaUploadAllowed('user-1', [{ sizeBytes: 10 }])
        ).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })
})
