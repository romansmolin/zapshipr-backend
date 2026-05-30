import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import type { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import type { IMediaRepository } from '@/modules/media/repositories/media-repository.interface'
import type { IPostsRepository } from '@/modules/post/repositories/posts-repository.interface'
import type { IWorkspaceRepository } from '@/modules/workspace/repositories/workspace-repository.interface'

import type { IUserRepository } from '../../repositories/user-repository.interface'
import type { User } from '../../entity/user.schema'
import type { UpdateUserSettingsInput } from '../../validation/user.schemas'

import type { IUserService, PlanWarning, UsageQuota, UserInfo, UserPlanSnapshot } from './user.service.interface'

import { getUserInfo as getUserInfoUseCase } from '../../use-cases/get-user-info.use-case'
import { getUserPlan as getUserPlanUseCase } from '../../use-cases/get-user-plan.use-case'
import { getUsageQuota as getUsageQuotaUseCase } from '../../use-cases/get-usage-quota.use-case'
import { getUsageWarnings as getUsageWarningsUseCase } from '../../use-cases/get-usage-warnings.use-case'
import { incrementAiUsage as incrementAiUsageUseCase } from '../../use-cases/increment-ai-usage.use-case'
import { assertCanCreateWorkspace as assertCanCreateWorkspaceUseCase } from '../../use-cases/assert-can-create-workspace.use-case'
import { assertCanConnectAccount as assertCanConnectAccountUseCase } from '../../use-cases/assert-can-connect-account.use-case'
import { assertCanUpdateAiCustomInstructions as assertCanUpdateAiCustomInstructionsUseCase } from '../../use-cases/assert-can-update-ai-custom-instructions.use-case'
import { assertPostMediaUploadAllowed as assertPostMediaUploadAllowedUseCase } from '../../use-cases/assert-post-media-upload-allowed.use-case'
import { updateUserSettings as updateUserSettingsUseCase } from '../../use-cases/update-user-settings.use-case'
import { deleteUserAccount as deleteUserAccountUseCase } from '../../use-cases/delete-user-account.use-case'

type UserDeps = {
    users: IUserRepository
    workspaces: IWorkspaceRepository
    posts: IPostsRepository
    accounts: IAccountRepository
    media: IMediaRepository
    mediaUploader: IMediaUploader
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
}

export class UserService implements IUserService {
    private readonly deps: UserDeps

    constructor(
        userRepository: IUserRepository,
        workspaceRepository: IWorkspaceRepository,
        postsRepository: IPostsRepository,
        accountRepository: IAccountRepository,
        mediaRepository: IMediaRepository,
        mediaUploader: IMediaUploader,
        db: NodePgDatabase<typeof dbSchema>,
        logger: ILogger
    ) {
        this.deps = {
            users: userRepository,
            workspaces: workspaceRepository,
            posts: postsRepository,
            accounts: accountRepository,
            media: mediaRepository,
            mediaUploader,
            db,
            logger,
        }
    }

    getUserInfo(userId: string): Promise<UserInfo> {
        return getUserInfoUseCase(this.deps, userId)
    }

    getUserPlan(userId: string): Promise<UserPlanSnapshot | null> {
        return getUserPlanUseCase(this.deps, userId)
    }

    getUsageQuota(userId: string): Promise<UsageQuota> {
        return getUsageQuotaUseCase(this.deps, userId)
    }

    getUsageWarnings(userId: string): Promise<PlanWarning[]> {
        return getUsageWarningsUseCase(this.deps, userId)
    }

    incrementAiUsage(userId: string): Promise<void> {
        return incrementAiUsageUseCase(this.deps, userId)
    }

    assertCanCreateWorkspace(userId: string): Promise<void> {
        return assertCanCreateWorkspaceUseCase(this.deps, userId)
    }

    assertCanConnectAccount(userId: string): Promise<void> {
        return assertCanConnectAccountUseCase(this.deps, userId)
    }

    assertCanUpdateAiCustomInstructions(userId: string): Promise<void> {
        return assertCanUpdateAiCustomInstructionsUseCase(this.deps, userId)
    }

    assertPostMediaUploadAllowed(userId: string, files: Array<{ sizeBytes: number }>): Promise<void> {
        return assertPostMediaUploadAllowedUseCase(this.deps, userId, files)
    }

    updateUserSettings(
        userId: string,
        data: UpdateUserSettingsInput,
        avatarFile?: Express.Multer.File
    ): Promise<User> {
        return updateUserSettingsUseCase(this.deps, userId, data, avatarFile)
    }

    deleteUserAccount(userId: string): Promise<void> {
        return deleteUserAccountUseCase(this.deps, userId)
    }
}
