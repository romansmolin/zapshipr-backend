import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import { SocilaMediaPlatform } from '@/modules/post/schemas/posts.schemas'

import { deleteAccount } from './delete-account.use-case'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'
import type { IPostsService } from '@/modules/post/services/posts-service.interface'

describe('deleteAccount', () => {
    let accountRepository: jest.Mocked<IAccountRepository>
    let logger: jest.Mocked<ILogger>
    let mediaUploader: jest.Mocked<IMediaUploader>
    let postsService: jest.Mocked<IPostsService>
    const previousBucket = process.env.AWS_S3_BUCKET

    beforeAll(() => {
        process.env.AWS_S3_BUCKET = 'easy-post'
    })

    beforeEach(() => {
        accountRepository = {
            connectAccount: jest.fn(),
            getAccountById: jest.fn(),
            getAccounts: jest.fn(),
            getAccountsByPlatform: jest.fn(),
            getAllAccounts: jest.fn(),
            deleteAccount: jest.fn(),
            deletePinterestBoardsByAccountId: jest.fn(),
            findAccountsWithExpiringAccessTokens: jest.fn(),
            updateAccessToken: jest.fn(),
            updateAccessTokenById: jest.fn(),
        } as unknown as jest.Mocked<IAccountRepository>

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as jest.Mocked<ILogger>

        mediaUploader = {
            upload: jest.fn(),
            delete: jest.fn(),
            listObjects: jest.fn(),
            getSignedUrl: jest.fn(),
            getPresignedUploadUrl: jest.fn(),
        } as unknown as jest.Mocked<IMediaUploader>

        postsService = {
            createPost: jest.fn(),
            editPost: jest.fn(),
            hasExistingMedia: jest.fn(),
            deletePost: jest.fn(),
            getPostsByDate: jest.fn(),
            getPostsByFilters: jest.fn(),
            getPostsFailedCount: jest.fn(),
            getFailedPostTargets: jest.fn(),
            retryPostTarget: jest.fn(),
            deletePostTarget: jest.fn(),
            cancelPostTarget: jest.fn(),
            checkAndUpdateBasePostStatus: jest.fn(),
            deletePostsOrphanedByAccount: jest.fn(),
            createPresignedUploadUrls: jest.fn(),
            processPostPreparationJob: jest.fn(),
        } as unknown as jest.Mocked<IPostsService>

        accountRepository.getAccountById.mockResolvedValue({
            id: 'account-1',
            userId: 'user-1',
            platform: SocilaMediaPlatform.INSTAGRAM,
            username: 'acc',
            pageId: 'page',
            pageName: 'page',
            accessToken: 'token',
            refreshToken: null,
            expiresAt: null,
            picture: 'https://easy-post.s3.amazonaws.com/user-1/accounts/avatar.jpg',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: null,
            workspaceId: 'workspace-1',
        } as any)
        accountRepository.deleteAccount.mockResolvedValue(true)
        postsService.deletePostsOrphanedByAccount.mockResolvedValue()
        mediaUploader.delete.mockResolvedValue()
    })

    it('cleans orphaned account posts via postsService during account deletion', async () => {
        const result = await deleteAccount(
            { accounts: accountRepository, logger, mediaUploader, postsService },
            { userId: 'user-1', workspaceId: 'workspace-1', accountId: 'account-1' }
        )

        expect(result).toEqual({ success: true })
        expect(postsService.deletePostsOrphanedByAccount).toHaveBeenCalledWith('user-1', 'account-1')
        expect(mediaUploader.delete).toHaveBeenCalledWith('https://easy-post.s3.amazonaws.com/user-1/accounts/avatar.jpg')
    })

    it('deletes account image when it is stored as path-style S3 URL', async () => {
        accountRepository.getAccountById.mockResolvedValue({
            id: 'account-1',
            userId: 'user-1',
            platform: SocilaMediaPlatform.INSTAGRAM,
            username: 'acc',
            pageId: 'page',
            pageName: 'page',
            accessToken: 'token',
            refreshToken: null,
            expiresAt: null,
            picture: 'https://s3.us-east-1.amazonaws.com/easy-post/user-1/accounts/avatar-path-style.jpg',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: null,
            workspaceId: 'workspace-1',
        } as any)

        await deleteAccount(
            { accounts: accountRepository, logger, mediaUploader, postsService },
            { userId: 'user-1', workspaceId: 'workspace-1', accountId: 'account-1' }
        )

        expect(mediaUploader.delete).toHaveBeenCalledWith(
            'https://s3.us-east-1.amazonaws.com/easy-post/user-1/accounts/avatar-path-style.jpg'
        )
    })

    afterAll(() => {
        process.env.AWS_S3_BUCKET = previousBucket
    })
})
