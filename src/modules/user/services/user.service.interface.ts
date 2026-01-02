import type { User } from '../entity/user.schema'

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
}

export interface IUserService {
    getUserInfo(userId: string): Promise<UserInfo>
    getUsageQuota(userId: string): Promise<UsageQuota>
    incrementConnectedAccountsUsage(userId: string): Promise<void>
    decrementConnectedAccountsUsage(userId: string): Promise<void>
    getUserPlan(userId: string): Promise<UserPlanSnapshot | null>
    incrementAiUsage(userId: string): Promise<void>
}
