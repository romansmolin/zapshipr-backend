import type { NewUser, User } from '../entity/user.schema'

export interface UserPlanRow {
    id: string
    planName: string
    billingStatus: string | null
    planType: 'yearly' | 'monthly'
    startDate: Date
    currentPeriodEnd: Date | null
    endDate: Date | null
}

export interface IUserRepository {
    createUser(user: NewUser): Promise<User>
    findByEmail(email: string): Promise<User | null>
    findById(id: string): Promise<User | null>
    findByStripeCustomerId(stripeCustomerId: string): Promise<User | null>
    updateUserProfile(userId: string, data: { name?: string; email?: string; avatar?: string | null }): Promise<User>
    updateRefreshToken(userId: string, refreshToken: string | null): Promise<void>
    updateUserPassword(userId: string, passwordHash: string): Promise<void>
    deleteById(userId: string): Promise<void>
    findActivePlan(userId: string): Promise<UserPlanRow | null>
    findLastPlan(userId: string): Promise<UserPlanRow | null>
    getAiUsageCount(userId: string, planId: string, periodStart: Date, periodEnd: Date): Promise<number>
    getPostMediaUsage(userId: string): Promise<{ files: number; storageBytes: number }>
}
