import type { OnboardingInput, Onboarding, PrimaryGoal, SalesProfile, SalesPolicy, CompletionLevel, OnboardingFormType } from '../validation/onboarding.schemas'

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
 * Calculates the completion level based on which fields are present.
 * - quick_start: Only required 5-7 fields present
 * - partial: Some deep setup fields present
 * - complete: All recommended fields present
 */
export function calculateCompletionLevel(input: OnboardingInput): CompletionLevel {
    // Count filled optional/deep fields
    let deepFieldsCount = 0
    const totalDeepFields = 9 // Total optional deep fields

    if (input.goal.expectedOutcome) deepFieldsCount++
    if (input.goal.successSignals && input.goal.successSignals.length > 0) deepFieldsCount++
    if (input.audience.awarenessLevel) deepFieldsCount++
    if (input.audience.painOrDesire) deepFieldsCount++
    if (input.voice.brandType) deepFieldsCount++
    if (input.voice.perspective) deepFieldsCount++
    if (input.contentStrategy.topics && input.contentStrategy.topics.length > 0) deepFieldsCount++
    if (input.contentStrategy.formats && input.contentStrategy.formats.length > 0) deepFieldsCount++
    if (input.contentStrategy.postingFrequency) deepFieldsCount++

    // Determine completion level
    if (deepFieldsCount === 0) {
        return 'quick_start'
    } else if (deepFieldsCount < totalDeepFields) {
        return 'partial'
    } else {
        return 'complete'
    }
}

/**
 * Derives form type from completion level or explicit input.
 * If formType is explicitly provided by frontend, use it.
 * Otherwise derive from completion level: 'quick_start' -> 'quick', else 'complex'
 */
function deriveFormType(
    inputFormType: OnboardingFormType | undefined,
    completionLevel: CompletionLevel
): OnboardingFormType {
    // If explicitly provided, use it
    if (inputFormType) {
        return inputFormType
    }

    // Otherwise derive from completion level
    return completionLevel === 'quick_start' ? 'quick' : 'complex'
}

/**
 * Normalizes onboarding input by:
 * 1. Adding workspaceId
 * 2. Adding meta timestamps and version
 * 3. Deriving sales defaults if not provided
 * 4. Ensuring all arrays are present
 * 5. Calculating completion level
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

    // Calculate completion level
    const completionLevel = calculateCompletionLevel(input)

    // Determine form type
    const formType = deriveFormType(input.formType, completionLevel)

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
            completionLevel,
            formType,
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
