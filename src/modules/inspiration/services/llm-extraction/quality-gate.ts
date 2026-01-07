import { YouTubeExtractionData } from './schemas/youtube-extraction.schema'

/**
 * Quality validation rules
 */
export interface QualityRules {
    minHooks: number
    minKeyPoints: number
    minQuotes: number
    minDraftsPerPlatform: number
    minContentAngles: number
    minTags: number
    maxDuplicateRatio: number // 0.0 - 1.0
}

/**
 * Quality validation result
 */
export interface QualityCheckResult {
    passed: boolean
    score: number // 0-100
    issues: QualityIssue[]
    suggestions: string[]
}

export interface QualityIssue {
    field: string
    code: QualityIssueCode
    message: string
    severity: 'error' | 'warning'
}

export type QualityIssueCode =
    | 'BELOW_MINIMUM'
    | 'EMPTY_FIELD'
    | 'DUPLICATE_CONTENT'
    | 'TOO_GENERIC'
    | 'MISSING_SPECIFICS'

/**
 * Default quality rules for YouTube extraction
 */
export const DEFAULT_QUALITY_RULES: QualityRules = {
    minHooks: 10,
    minKeyPoints: 5,
    minQuotes: 3,
    minDraftsPerPlatform: 2,
    minContentAngles: 5,
    minTags: 5,
    maxDuplicateRatio: 0.2,
}

/**
 * Stricter rules for retry attempt
 */
export const RETRY_QUALITY_RULES: QualityRules = {
    minHooks: 15,
    minKeyPoints: 7,
    minQuotes: 5,
    minDraftsPerPlatform: 3,
    minContentAngles: 7,
    minTags: 8,
    maxDuplicateRatio: 0.1,
}

/**
 * Generic phrases that indicate low-quality extraction
 */
const GENERIC_PHRASES = [
    'valuable insights',
    'important information',
    'key takeaways',
    'learn more',
    'check it out',
    'must watch',
    'highly recommended',
    'great content',
    'amazing video',
    'really interesting',
    'very helpful',
    'useful tips',
]

export interface IQualityGate {
    /**
     * Validate extraction quality
     */
    validate(extraction: YouTubeExtractionData, rules?: QualityRules): QualityCheckResult

    /**
     * Calculate quality score (0-100)
     */
    calculateScore(extraction: YouTubeExtractionData, rules?: QualityRules): number

    /**
     * Get suggestions for improving extraction
     */
    getSuggestions(issues: QualityIssue[]): string[]
}

export class QualityGate implements IQualityGate {
    validate(
        extraction: YouTubeExtractionData,
        rules: QualityRules = DEFAULT_QUALITY_RULES
    ): QualityCheckResult {
        const issues: QualityIssue[] = []

        // Check minimum counts
        this.checkMinimum(extraction.hooks, 'hooks', rules.minHooks, issues)
        this.checkMinimum(extraction.keyPoints, 'keyPoints', rules.minKeyPoints, issues)
        this.checkMinimum(extraction.quotes, 'quotes', rules.minQuotes, issues)
        this.checkMinimum(extraction.contentAngles, 'contentAngles', rules.minContentAngles, issues)
        this.checkMinimum(extraction.tags, 'tags', rules.minTags, issues)

        // Check drafts per platform
        this.checkDrafts(extraction.drafts, rules.minDraftsPerPlatform, issues)

        // Check for duplicates
        this.checkDuplicates(extraction.hooks, 'hooks', rules.maxDuplicateRatio, issues)
        this.checkDuplicates(extraction.keyPoints, 'keyPoints', rules.maxDuplicateRatio, issues)

        // Check for generic content
        this.checkGenericContent(extraction.hooks, 'hooks', issues)
        this.checkGenericContent(extraction.keyPoints, 'keyPoints', issues)

        // Check for specificity in key points
        this.checkSpecificity(extraction.keyPoints, 'keyPoints', issues)

        // Calculate score
        const score = this.calculateScore(extraction, rules)

        // Get suggestions
        const suggestions = this.getSuggestions(issues)

        // Pass if no errors and score >= 60
        const hasErrors = issues.some((i) => i.severity === 'error')
        const passed = !hasErrors && score >= 60

        return { passed, score, issues, suggestions }
    }

    calculateScore(
        extraction: YouTubeExtractionData,
        rules: QualityRules = DEFAULT_QUALITY_RULES
    ): number {
        let score = 0
        const maxScore = 100

        // Hooks (25 points)
        const hooksScore = Math.min(1, extraction.hooks.length / rules.minHooks) * 25
        score += hooksScore

        // Key Points (20 points)
        const keyPointsScore = Math.min(1, extraction.keyPoints.length / rules.minKeyPoints) * 20
        score += keyPointsScore

        // Quotes (15 points)
        const quotesScore = Math.min(1, extraction.quotes.length / rules.minQuotes) * 15
        score += quotesScore

        // Content Angles (10 points)
        const anglesScore = Math.min(1, extraction.contentAngles.length / rules.minContentAngles) * 10
        score += anglesScore

        // Drafts (20 points - 5 per platform)
        const draftsScore = this.calculateDraftsScore(extraction.drafts, rules.minDraftsPerPlatform)
        score += draftsScore

        // Tags (5 points)
        const tagsScore = Math.min(1, extraction.tags.length / rules.minTags) * 5
        score += tagsScore

        // Uniqueness bonus (5 points)
        const uniquenessBonus = this.calculateUniquenessBonus(extraction)
        score += uniquenessBonus

        return Math.min(maxScore, Math.round(score))
    }

    getSuggestions(issues: QualityIssue[]): string[] {
        const suggestions: string[] = []
        const issuesByCode = new Map<QualityIssueCode, QualityIssue[]>()

        // Group issues by code
        for (const issue of issues) {
            const existing = issuesByCode.get(issue.code) || []
            existing.push(issue)
            issuesByCode.set(issue.code, existing)
        }

        // Generate suggestions
        if (issuesByCode.has('BELOW_MINIMUM')) {
            const fields = issuesByCode.get('BELOW_MINIMUM')!.map((i) => i.field).join(', ')
            suggestions.push(`Generate more content for: ${fields}`)
        }

        if (issuesByCode.has('DUPLICATE_CONTENT')) {
            suggestions.push('Make each hook and key point unique - avoid repetition')
        }

        if (issuesByCode.has('TOO_GENERIC')) {
            suggestions.push('Be more specific - use actual names, numbers, and examples from the video')
        }

        if (issuesByCode.has('MISSING_SPECIFICS')) {
            suggestions.push('Include specific frameworks, statistics, or quotes mentioned in the video')
        }

        if (issuesByCode.has('EMPTY_FIELD')) {
            const fields = issuesByCode.get('EMPTY_FIELD')!.map((i) => i.field).join(', ')
            suggestions.push(`Ensure all platform drafts are populated: ${fields}`)
        }

        return suggestions
    }

    private checkMinimum(
        items: any[],
        field: string,
        minimum: number,
        issues: QualityIssue[]
    ): void {
        if (!items || items.length === 0) {
            issues.push({
                field,
                code: 'EMPTY_FIELD',
                message: `${field} is empty`,
                severity: 'error',
            })
        } else if (items.length < minimum) {
            issues.push({
                field,
                code: 'BELOW_MINIMUM',
                message: `${field} has ${items.length} items, minimum is ${minimum}`,
                severity: 'error',
            })
        }
    }

    private checkDrafts(
        drafts: YouTubeExtractionData['drafts'],
        minPerPlatform: number,
        issues: QualityIssue[]
    ): void {
        const platforms = ['threads', 'x', 'linkedin', 'instagramCaption'] as const

        for (const platform of platforms) {
            const items = drafts[platform] || []
            if (items.length < minPerPlatform) {
                issues.push({
                    field: `drafts.${platform}`,
                    code: items.length === 0 ? 'EMPTY_FIELD' : 'BELOW_MINIMUM',
                    message: `${platform} has ${items.length} drafts, minimum is ${minPerPlatform}`,
                    severity: items.length === 0 ? 'error' : 'warning',
                })
            }
        }
    }

    private checkDuplicates(
        items: string[],
        field: string,
        maxRatio: number,
        issues: QualityIssue[]
    ): void {
        if (!items || items.length < 2) return

        const normalized = items.map((s) => s.toLowerCase().trim())
        const unique = new Set(normalized)
        const duplicateRatio = 1 - unique.size / normalized.length

        if (duplicateRatio > maxRatio) {
            issues.push({
                field,
                code: 'DUPLICATE_CONTENT',
                message: `${field} has ${Math.round(duplicateRatio * 100)}% duplicate content`,
                severity: 'warning',
            })
        }
    }

    private checkGenericContent(items: string[], field: string, issues: QualityIssue[]): void {
        if (!items || items.length === 0) return

        let genericCount = 0
        for (const item of items) {
            const lower = item.toLowerCase()
            if (GENERIC_PHRASES.some((phrase) => lower.includes(phrase))) {
                genericCount++
            }
        }

        const genericRatio = genericCount / items.length
        if (genericRatio > 0.3) {
            issues.push({
                field,
                code: 'TOO_GENERIC',
                message: `${Math.round(genericRatio * 100)}% of ${field} contain generic phrases`,
                severity: 'warning',
            })
        }
    }

    private checkSpecificity(items: string[], field: string, issues: QualityIssue[]): void {
        if (!items || items.length === 0) return

        // Check if at least 50% contain numbers, proper nouns, or quotes
        const specificPattern = /\d+|["'][^"']+["']|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/
        let specificCount = 0

        for (const item of items) {
            if (specificPattern.test(item)) {
                specificCount++
            }
        }

        const specificRatio = specificCount / items.length
        if (specificRatio < 0.4) {
            issues.push({
                field,
                code: 'MISSING_SPECIFICS',
                message: `Only ${Math.round(specificRatio * 100)}% of ${field} contain specific details`,
                severity: 'warning',
            })
        }
    }

    private calculateDraftsScore(drafts: YouTubeExtractionData['drafts'], minPerPlatform: number): number {
        let score = 0
        const platforms = ['threads', 'x', 'linkedin', 'instagramCaption'] as const

        for (const platform of platforms) {
            const items = drafts[platform] || []
            const platformScore = Math.min(1, items.length / minPerPlatform) * 5
            score += platformScore
        }

        return score
    }

    private calculateUniquenessBonus(extraction: YouTubeExtractionData): number {
        let bonus = 0

        // Check hooks uniqueness
        const hooksUnique = new Set(extraction.hooks.map((h) => h.toLowerCase().trim()))
        if (hooksUnique.size === extraction.hooks.length) {
            bonus += 2.5
        }

        // Check key points uniqueness
        const kpUnique = new Set(extraction.keyPoints.map((k) => k.toLowerCase().trim()))
        if (kpUnique.size === extraction.keyPoints.length) {
            bonus += 2.5
        }

        return bonus
    }
}

/**
 * Build retry prompt enhancement based on quality issues
 */
export function buildRetryPromptEnhancement(issues: QualityIssue[], suggestions: string[]): string {
    let enhancement = '\n\n⚠️ QUALITY REQUIREMENTS (PREVIOUS ATTEMPT FAILED):\n\n'

    // Add specific requirements based on issues
    const needsMore: string[] = []
    const needsBetter: string[] = []

    for (const issue of issues) {
        if (issue.code === 'BELOW_MINIMUM' || issue.code === 'EMPTY_FIELD') {
            needsMore.push(issue.field)
        } else {
            needsBetter.push(issue.field)
        }
    }

    if (needsMore.length > 0) {
        enhancement += `GENERATE MORE: ${needsMore.join(', ')}\n`
    }

    if (needsBetter.length > 0) {
        enhancement += `IMPROVE QUALITY: ${needsBetter.join(', ')}\n`
    }

    enhancement += '\nMUST FIX:\n'
    for (const suggestion of suggestions) {
        enhancement += `• ${suggestion}\n`
    }

    enhancement += `
STRICT MINIMUMS FOR RETRY:
- hooks: at least 15 (different styles: questions, statistics, contrarian)
- keyPoints: at least 7 (with specific numbers/names)
- quotes: at least 5 (with timestamps if possible)
- drafts: at least 3 per platform
- contentAngles: at least 7

DO NOT use generic phrases like "valuable insights" or "check it out".
Include SPECIFIC names, numbers, frameworks from the video.`

    return enhancement
}

