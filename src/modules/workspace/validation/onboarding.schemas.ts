import { z } from 'zod'

// Enums
export const PrimaryGoalEnum = z.enum([
    'grow_audience',
    'generate_leads',
    'sell_product',
    'build_personal_brand',
    'educate_audience',
    'enter_new_niche',
    'maintain_consistency',
])

export const SuccessSignalEnum = z.enum([
    'engagement',
    'followers_growth',
    'dms',
    'website_clicks',
    'sales',
    'authority_perception',
])

export const AudienceTypeEnum = z.enum([
    'founders',
    'solopreneurs',
    'creators',
    'smb_owners',
    'freelancers',
    'developers',
    'marketers',
    'general',
])

export const AwarenessLevelEnum = z.enum([
    'beginner',
    'problem_aware',
    'solution_aware',
    'product_aware',
    'advanced',
])

export const BrandTypeEnum = z.enum([
    'personal',
    'personal_business_hybrid',
    'brand_company',
    'anonymous_theme_page',
])

export const ToneEnum = z.enum([
    'casual',
    'professional',
    'friendly',
    'bold',
    'direct',
    'inspirational',
    'analytical',
    'provocative',
])

export const PerspectiveEnum = z.enum(['first_person_i', 'first_person_we', 'neutral'])

export const ContentPillarEnum = z.enum([
    'education',
    'storytelling',
    'opinions_takes',
    'case_studies',
    'behind_the_scenes',
    'promotions',
    'community_questions',
])

export const ContentFormatEnum = z.enum([
    'short_posts',
    'threads',
    'hooks',
    'carousels',
    'quotes',
    'educational_breakdowns',
])

export const PostingFrequencyEnum = z.enum(['daily', '3_4_per_week', '1_2_per_week'])

export const PlatformEnum = z.enum(['threads', 'instagram', 'tiktok', 'linkedin'])

export const HardConstraintEnum = z.enum([
    'no_emojis',
    'no_hashtags',
    'no_sales_language',
    'no_clickbait',
    'no_ai_mentions',
    'avoid_controversial_topics',
])

export const SalesProfileEnum = z.enum(['no_sales', 'indirect_sales', 'direct_sales'])

export const ContentIntentEnum = z.enum(['value', 'authority', 'engagement', 'story', 'soft_promo', 'direct_sale'])

export const CtaSeverityEnum = z.enum(['none', 'implicit', 'soft', 'direct'])

// Completion level and form type enums
export const CompletionLevelEnum = z.enum(['quick_start', 'partial', 'complete'])
export const OnboardingFormTypeEnum = z.enum(['quick', 'complex'])

export const goalInputSchema = z.object({
    primaryGoal: PrimaryGoalEnum,
    expectedOutcome: z.string().min(1).optional(),
    successSignals: z.array(SuccessSignalEnum).min(1).optional(),
})

export const audienceInputSchema = z.object({
    audienceType: AudienceTypeEnum,
    awarenessLevel: AwarenessLevelEnum.optional(),
    painOrDesire: z.string().min(1).optional(),
    geography: z.string().optional(),
    languages: z.array(z.string()).optional(),
})

export const personalityAnchorsInputSchema = z
    .object({
        like: z.string().optional(),
        notLike: z.string().optional(),
    })
    .optional()

export const voiceInputSchema = z.object({
    brandType: BrandTypeEnum.optional(),
    tones: z.array(ToneEnum).min(1),
    personalityAnchors: personalityAnchorsInputSchema,
    perspective: PerspectiveEnum.optional(),
})

export const contentStrategyInputSchema = z.object({
    topics: z.array(z.string()).min(1).optional(),
    pillars: z.array(ContentPillarEnum).min(1),
    formats: z.array(ContentFormatEnum).min(1).optional(),
    postingFrequency: PostingFrequencyEnum.optional(),
})

export const constraintsInputSchema = z.object({
    platforms: z.array(PlatformEnum).min(1),
    hardConstraints: z.array(HardConstraintEnum).default([]),
    legalOrEthicalNotes: z.string().optional(),
})

export const salesPolicyInputSchema = z.object({
    maxSalesPostsRatio: z.number().min(0).max(1),
    allowedIntents: z.array(ContentIntentEnum).min(1),
    ctaSeverity: CtaSeverityEnum,
})

export const salesInputSchema = z.object({
    profile: SalesProfileEnum,
    policy: salesPolicyInputSchema,
})

export const postExampleInputSchema = z
    .object({
        text: z.string().optional(),
        url: z.string().url().optional(),
    })
    .optional()

export const examplesInputSchema = z
    .object({
        likedPost: postExampleInputSchema,
        dislikedPost: postExampleInputSchema,
    })
    .optional()

export const onboardingInputSchema = z.object({
    goal: goalInputSchema,
    audience: audienceInputSchema,
    voice: voiceInputSchema,
    contentStrategy: contentStrategyInputSchema,
    constraints: constraintsInputSchema,
    sales: salesInputSchema.optional(),
    examples: examplesInputSchema,
    additionalInfo: z.string().optional(),
    formType: OnboardingFormTypeEnum.optional(),
})

export const onboardingMetaSchema = z.object({
    version: z.number().default(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    completionLevel: CompletionLevelEnum.optional(),
    formType: OnboardingFormTypeEnum.optional(),
})

export const onboardingSchema = onboardingInputSchema.extend({
    workspaceId: z.string().uuid(),
    meta: onboardingMetaSchema,
    sales: salesInputSchema,
})

export const updateOnboardingInputSchema = onboardingInputSchema.partial()

export type OnboardingInput = z.infer<typeof onboardingInputSchema>
export type UpdateOnboardingInput = z.infer<typeof updateOnboardingInputSchema>
export type Onboarding = z.infer<typeof onboardingSchema>
export type PrimaryGoal = z.infer<typeof PrimaryGoalEnum>
export type SalesProfile = z.infer<typeof SalesProfileEnum>
export type SalesPolicy = z.infer<typeof salesPolicyInputSchema>
export type CompletionLevel = z.infer<typeof CompletionLevelEnum>
export type OnboardingFormType = z.infer<typeof OnboardingFormTypeEnum>
