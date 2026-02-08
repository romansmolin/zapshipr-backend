import { Workspace } from '@/modules/workspace/entity/workspace.schema'
import type { User } from '../entity/user.schema'
import type { UpdateUserSettingsInput } from '../validation/user.schemas'

export interface UsageQuota {
    connectedAccounts: {
        used: number
        limit: number
    }
}

export interface UserPlanSnapshot {
    planName?: string | null
}

export interface UserInfo {
    user: User
    planName: string | null
    userWorkspaces: Workspace[]
}

export interface IUserService {
    getUserInfo(userId: string): Promise<UserInfo>
    getUsageQuota(userId: string): Promise<UsageQuota>
    incrementConnectedAccountsUsage(userId: string): Promise<void>
    decrementConnectedAccountsUsage(userId: string): Promise<void>
    getUserPlan(userId: string): Promise<UserPlanSnapshot | null>
    incrementAiUsage(userId: string): Promise<void>
    updateUserSettings(
        userId: string,
        data: UpdateUserSettingsInput,
        avatarFile?: Express.Multer.File
    ): Promise<User>
    deleteUserAccout(userId: string): Promise<void>
}
