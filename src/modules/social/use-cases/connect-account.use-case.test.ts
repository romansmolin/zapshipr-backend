import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import { connectAccount } from './connect-account.use-case'

describe('connectAccount plan limits', () => {
    const account = {
        id: 'acc-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        platform: SocilaMediaPlatform.INSTAGRAM,
        username: 'ig',
        accessToken: 'token',
        connectedAt: new Date(),
        pageId: 'page-1',
        picture: null,
        refreshToken: null,
        expiresIn: null,
        refreshExpiresIn: null,
        maxVideoPostDurationSec: null,
        privacyLevelOptions: null,
    } as any

    let repository: any
    let userService: any
    let logger: any

    beforeEach(() => {
        repository = {
            findByTenantPlatformAndPage: jest.fn(async () => null),
            save: jest.fn(async () => account),
        }
        userService = {
            assertCanConnectAccount: jest.fn(),
        }
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        }
    })

    it('checks plan limit before creating a new social account', async () => {
        await connectAccount({ accounts: repository, userService, logger }, { account })

        expect(userService.assertCanConnectAccount).toHaveBeenCalledWith('user-1')
        expect(repository.save).toHaveBeenCalledTimes(1)
    })

    it('propagates plan limit errors', async () => {
        userService.assertCanConnectAccount.mockRejectedValue({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })

        await expect(
            connectAccount({ accounts: repository, userService, logger }, { account })
        ).rejects.toMatchObject({
            code: ErrorCode.PLAN_LIMIT_REACHED,
            httpCode: 403,
        })
    })
})
