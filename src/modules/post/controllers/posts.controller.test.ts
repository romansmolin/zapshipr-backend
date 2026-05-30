import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import { PostTargetEntity } from '@/modules/post/entity/post-target'

import { PostsController } from './posts.controller'

import type { IPostsService } from '@/modules/post/services/posts/posts-service.interface'
import type { IUserService } from '@/modules/user/services/user/user.service.interface'
import type { IWorkspaceProfileService } from '@/modules/workspace/services/workspace-profile/workspace-profile.service'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { Request, Response } from 'express'

describe('PostsController failed endpoints', () => {
    let controller: PostsController
    let postsService: jest.Mocked<IPostsService>
    let logger: jest.Mocked<ILogger>

    beforeEach(() => {
        postsService = {
            createPost: jest.fn(),
            createPresignedUploadUrls: jest.fn(),
            processPostPreparationJob: jest.fn(),
            editPost: jest.fn(),
            hasExistingMedia: jest.fn(),
            deletePost: jest.fn(),
            getPostsByFilters: jest.fn(),
            getPostsByDate: jest.fn(),
            getPostsFailedCount: jest.fn(),
            getFailedPostTargets: jest.fn(),
            retryPostTarget: jest.fn(),
            deletePostTarget: jest.fn(),
            cancelPostTarget: jest.fn(),
            checkAndUpdateBasePostStatus: jest.fn(),
            deletePostsOrphanedByAccount: jest.fn(),
        } as unknown as jest.Mocked<IPostsService>

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as jest.Mocked<ILogger>

        const userService = {} as jest.Mocked<IUserService>
        const workspaceProfileService = {} as jest.Mocked<IWorkspaceProfileService>

        controller = new PostsController(postsService, userService, workspaceProfileService, logger)
    })

    it('returns failedCount and count for failed-count endpoint', async () => {
        postsService.getPostsFailedCount.mockResolvedValue(3)
        const req = {
            user: { id: 'user-1' },
            workspaceId: 'workspace-1',
        } as unknown as Request
        const res = {
            json: jest.fn(),
        } as unknown as Response

        await controller.getPostsFailedCount(req, res, jest.fn())

        expect(postsService.getPostsFailedCount).toHaveBeenCalledWith('user-1', 'workspace-1')
        expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({
            failedCount: 3,
            count: 3,
        })
    })

    it('returns failed targets payload', async () => {
        const targets = [
            new PostTargetEntity(
                'post-1',
                'account-1',
                'instagram',
                'FAILED',
                'Seed failure'
            ),
        ]
        postsService.getFailedPostTargets.mockResolvedValue(targets)
        const req = {
            user: { id: 'user-1' },
            workspaceId: 'workspace-1',
        } as unknown as Request
        const res = {
            json: jest.fn(),
        } as unknown as Response

        await controller.getFailedPostTargets(req, res, jest.fn())

        expect(postsService.getFailedPostTargets).toHaveBeenCalledWith('user-1', 'workspace-1')
        expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({ targets })
    })

    it('throws unauthorized when user is absent', async () => {
        const req = {
            workspaceId: 'workspace-1',
        } as unknown as Request
        const res = {
            json: jest.fn(),
        } as unknown as Response

        await expect(controller.getPostsFailedCount(req, res, jest.fn())).rejects.toMatchObject({
            code: ErrorCode.UNAUTHORIZED,
            httpCode: 401,
        } satisfies Partial<BaseAppError>)
    })
})

