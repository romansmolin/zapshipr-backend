import type { OnboardingInput, Onboarding, PrimaryGoal, SalesProfile, SalesPolicy } from '../validation/onboarding.schemas'

// Mapping from primary goals to default sales profile
const GOAL_SALES_PROFILE: Record<PrimaryGoal, SalesProfile> = {
    grow_audience: 'no_sales',
    generate_leads: 'indirect_sales',
    sell_product: 'direct_sales',
    build_personal_brand: 'indirect_sales',
    educate_audience: 'no_sales',
    enter_new_niche: 'no_sales',
    maintain_consistency: 'no_sales',
}

// Default sales policies based on sales profile
const DEFAULT_SALES_POLICIES: Record<SalesProfile, SalesPolicy> = {
    no_sales: {
        maxSalesPostsRatio: 0,
        allowedIntents: ['value', 'authority', 'engagement', 'story'],
        ctaSeverity: 'none',
    },
    indirect_sales: {
        maxSalesPostsRatio: 0.2,
        allowedIntents: ['value', 'authority', 'engagement', 'story', 'soft_promo'],
        ctaSeverity: 'soft',
    },
    direct_sales: {
        maxSalesPostsRatio: 0.3,
        allowedIntents: ['value', 'authority', 'engagement', 'story', 'soft_promo', 'direct_sale'],
        ctaSeverity: 'direct',
    },
}

/**
 * Normalizes onboarding input by:
 * 1. Adding workspaceId
 * 2. Adding meta timestamps and version
 * 3. Deriving sales defaults if not provided
 * 4. Ensuring all arrays are present
 */
export function normalizeOnboarding(input: OnboardingInput, workspaceId: string): Onboarding {
    const now = new Date().toISOString()

    // Derive sales profile and policy if not provided
    const salesProfile = input.sales?.profile ?? GOAL_SALES_PROFILE[input.goal.primaryGoal]
    const salesPolicy = input.sales?.policy ?? DEFAULT_SALES_POLICIES[salesProfile]

    // Normalize arrays
    const normalizedConstraints = {
        ...input.constraints,
        hardConstraints: input.constraints.hardConstraints ?? [],
    }

    const normalizedAudience = {
        ...input.audience,
        languages: input.audience.languages ?? [],
    }

    return {
        workspaceId,
        goal: input.goal,
        audience: normalizedAudience,
        voice: input.voice,
        contentStrategy: input.contentStrategy,
        constraints: normalizedConstraints,
        sales: {
            profile: salesProfile,
            policy: salesPolicy,
        },
        examples: input.examples,
        additionalInfo: input.additionalInfo,
        meta: {
            version: 1,
            createdAt: now,
            updatedAt: now,
        },
    }
}

/**
 * Validates that client didn't send forbidden server-side fields
 */
export function validateOnboardingInput(input: any): void {
    if ('workspaceId' in input) {
        throw new Error('workspaceId must not be provided by client')
    }
    if ('meta' in input) {
        throw new Error('meta must not be provided by client')
    }
}
