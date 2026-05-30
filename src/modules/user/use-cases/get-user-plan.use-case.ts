import { PLAN_LIMITS } from '@/shared/consts/plan-limits.const'
import { normalizeUserPlan } from '@/shared/consts/plans'

import type { IUserRepository } from '../repositories/user-repository.interface'
import type { UserPlanSnapshot } from '../services/user/user.service.interface'

export type GetUserPlanDeps = {
    users: IUserRepository
}

export const getUserPlan = async (
    { users }: GetUserPlanDeps,
    userId: string
): Promise<UserPlanSnapshot | null> => {
    const activePlan = await users.findActivePlan(userId)

    if (!activePlan) {
        const lastPlan = await users.findLastPlan(userId)
        if (!lastPlan) return null

        const normalizedPlanName = normalizeUserPlan(lastPlan.planName)
        return {
            id: lastPlan.id,
            planName: normalizedPlanName,
            billingStatus: 'inactive',
            isActive: false,
            periodStart: lastPlan.startDate,
            periodEnd: lastPlan.currentPeriodEnd ?? lastPlan.endDate,
            priceMonthlyEur: PLAN_LIMITS[normalizedPlanName].priceMonthlyEur,
            trialEndsAt: null,
            trialDaysRemaining: null,
            planType: lastPlan.planType,
        }
    }

    const normalizedPlanName = normalizeUserPlan(activePlan.planName)
    const billingStatus = activePlan.billingStatus ?? 'active'
    const trialEndsAt =
        billingStatus === 'trialing' ? (activePlan.currentPeriodEnd ?? activePlan.endDate) : null
    const trialDaysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null

    return {
        id: activePlan.id,
        planName: normalizedPlanName,
        billingStatus,
        isActive: true,
        periodStart: activePlan.startDate,
        periodEnd: activePlan.currentPeriodEnd ?? activePlan.endDate,
        priceMonthlyEur: PLAN_LIMITS[normalizedPlanName].priceMonthlyEur,
        planType: activePlan.planType,
        trialEndsAt,
        trialDaysRemaining,
    }
}
