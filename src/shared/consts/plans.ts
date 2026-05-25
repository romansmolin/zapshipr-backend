export enum UserPlans {
    STARTER = 'STARTER',
    PRO = 'PRO',
}

const PLAN_ALIASES: Record<string, UserPlans> = {
    STARTER: UserPlans.STARTER,
    PRO: UserPlans.PRO,
}

export const normalizeUserPlan = (planName?: string | null): UserPlans => {
    if (!planName) return UserPlans.STARTER

    return PLAN_ALIASES[planName.toUpperCase()] ?? UserPlans.STARTER
}
