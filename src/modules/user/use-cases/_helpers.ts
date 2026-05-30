import { PLAN_CRITICAL_THRESHOLD, PLAN_WARNING_THRESHOLD } from '@/shared/consts/plan-limits.const'

import type { PlanWarning, QuotaMetric, UserPlanSnapshot } from '../services/user/user.service.interface'

export const resolveUsagePeriod = (plan: UserPlanSnapshot): { start: Date; end: Date } => {
    const now = new Date()

    if (plan.periodEnd && plan.periodEnd.getTime() > now.getTime() && plan.periodStart < plan.periodEnd) {
        return { start: plan.periodStart, end: plan.periodEnd }
    }

    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
    return { start, end }
}

export const buildWarnings = (
    key: PlanWarning['key'],
    used: number,
    limit: number,
    label: string
): PlanWarning[] => {
    if (limit <= 0) return []

    const ratio = used / limit
    if (ratio < PLAN_WARNING_THRESHOLD) return []

    return [
        {
            key,
            level: ratio >= PLAN_CRITICAL_THRESHOLD ? 'critical' : 'warning',
            used,
            limit,
            ratio,
            message: `${label} is ${(ratio * 100).toFixed(0)}% used`,
        },
    ]
}

export const toQuotaMetric = (used: number, limit: number): QuotaMetric => ({
    used,
    limit,
    remaining: Math.max(0, limit - used),
})

export const extractKeyFromUrl = (url: string): string | null => {
    try {
        const key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''))
        return key || null
    } catch {
        return null
    }
}
