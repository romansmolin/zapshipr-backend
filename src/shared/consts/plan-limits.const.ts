import { UserPlans } from '@/shared/consts/plans'

export interface PlanLimits {
    workspaceLimit: number
    connectedAccountsLimit: number
    aiActionsPerMonth: number
    storageBytesLimit: number
    filesLimit: number
    maxFileSizeBytes: number
    priceMonthlyEur: number
}

export const PLAN_LIMITS: Record<UserPlans, PlanLimits> = {
    [UserPlans.STARTER]: {
        workspaceLimit: 3,
        connectedAccountsLimit: 15,
        aiActionsPerMonth: 1000,
        storageBytesLimit: 25 * 1024 * 1024 * 1024,
        filesLimit: 5000,
        maxFileSizeBytes: 500 * 1024 * 1024,
        priceMonthlyEur: 15,
    },
    [UserPlans.PRO]: {
        workspaceLimit: 3,
        connectedAccountsLimit: 15,
        aiActionsPerMonth: 1000,
        storageBytesLimit: 25 * 1024 * 1024 * 1024,
        filesLimit: 5000,
        maxFileSizeBytes: 500 * 1024 * 1024,
        priceMonthlyEur: 15,
    },
}

export const PLAN_WARNING_THRESHOLD = 0.8
export const PLAN_CRITICAL_THRESHOLD = 0.95
