import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { UserPlans, normalizeUserPlan } from '@/shared/consts/plans'

import { getUserPlan, type GetUserPlanDeps } from './get-user-plan.use-case'

export type AssertCanUpdateAiCustomInstructionsDeps = GetUserPlanDeps

export const assertCanUpdateAiCustomInstructions = async (
    deps: AssertCanUpdateAiCustomInstructionsDeps,
    userId: string
): Promise<void> => {
    const plan = await getUserPlan(deps, userId)
    if (!plan) {
        throw new BaseAppError('Unable to resolve user plan', ErrorCode.UNKNOWN_ERROR, 500)
    }

    const normalizedPlan = normalizeUserPlan(plan.planName)

    if (normalizedPlan !== UserPlans.PRO) {
        throw new BaseAppError(
            'AI custom instructions are available only on the Pro plan',
            ErrorCode.PLAN_LIMIT_REACHED,
            403
        )
    }
}
