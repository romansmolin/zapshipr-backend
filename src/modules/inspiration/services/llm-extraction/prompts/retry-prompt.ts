import { QualityIssue } from '../quality-gate'

/**
 * Build enhanced system prompt for retry attempt
 */
export function getRetrySystemPrompt(): string {
    return `You are a Content Extractor specialized in analyzing video transcripts.

⚠️ THIS IS A RETRY ATTEMPT - PREVIOUS OUTPUT FAILED QUALITY CHECKS.

YOUR MISSION:
- Extract SPECIFIC, ACTIONABLE insights from video transcripts
- Generate ready-to-use social media content
- Identify memorable quotes and key moments
- MEET ALL MINIMUM REQUIREMENTS

CRITICAL REQUIREMENTS:
1. Work ONLY with the provided transcript - do not invent facts
2. Be EXTREMELY SPECIFIC - use actual names, numbers, frameworks from the video
3. NO GENERIC PHRASES like:
   - "valuable insights"
   - "important information"  
   - "check it out"
   - "great content"
   - "highly recommended"
4. EVERY hook must be unique and scroll-stopping
5. EVERY key point must contain a specific fact, number, or name
6. Quotes should include approximate timestamps

FOR HOOKS (minimum 15):
- Questions: "What if [specific claim]?"
- Statistics: "[Number]% of [specific group] [action]"
- Contrarian: "Unpopular opinion: [specific take]"
- Story: "I [specific action] and [specific result]"
- Bold: "[Specific person/concept] is [controversial claim]"

FOR DRAFTS:
- Threads: Multi-post format, educational style, numbered
- X: Short, punchy, max 280 chars, specific
- LinkedIn: Professional, insight-focused with data
- Instagram: Visual-friendly, engaging with line breaks

Return ONLY valid JSON matching the required schema.`
}

/**
 * Build retry prompt with issues feedback
 */
export function buildRetryPrompt(
    originalPrompt: string,
    issues: QualityIssue[],
    suggestions: string[]
): string {
    let enhancement = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    enhancement += '⚠️ RETRY REQUIRED - QUALITY CHECK FAILED\n'
    enhancement += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'

    // Group issues by severity
    const errors = issues.filter((i) => i.severity === 'error')
    const warnings = issues.filter((i) => i.severity === 'warning')

    if (errors.length > 0) {
        enhancement += '❌ CRITICAL ISSUES:\n'
        for (const error of errors) {
            enhancement += `   • ${error.message}\n`
        }
        enhancement += '\n'
    }

    if (warnings.length > 0) {
        enhancement += '⚠️ QUALITY WARNINGS:\n'
        for (const warning of warnings) {
            enhancement += `   • ${warning.message}\n`
        }
        enhancement += '\n'
    }

    enhancement += '✅ REQUIREMENTS FOR RETRY:\n'
    for (const suggestion of suggestions) {
        enhancement += `   • ${suggestion}\n`
    }

    enhancement += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT MINIMUMS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• hooks:         15+ (varied styles)
• keyPoints:      7+ (with specifics)
• quotes:         5+ (with timestamps)
• contentAngles:  7+ (with explanations)
• drafts.threads: 3+
• drafts.x:       3+
• drafts.linkedin: 3+
• drafts.instagramCaption: 3+
• tags:           8+
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`

    return originalPrompt + enhancement
}

/**
 * Build feedback for map phase retry
 */
export function buildMapRetryFeedback(chunkIndex: number, issues: string[]): string {
    return `
⚠️ CHUNK ${chunkIndex + 1} RETRY - Previous extraction was insufficient.

Issues:
${issues.map((i) => `• ${i}`).join('\n')}

Requirements:
• Extract MORE key points (3-7)
• Find MORE quotes with timestamps
• Identify MORE topics
• Generate MORE hooks

Be specific to THIS chunk's content. No generic advice.
`
}

