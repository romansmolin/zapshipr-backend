import { ChunkNotes } from './map-prompt'
import { getYouTubeExtractionJsonSchema } from '../schemas/youtube-extraction.schema'

/**
 * Reduce Phase: Combine chunk notes into final extraction
 */

/**
 * Get JSON Schema for Reduce phase (same as final YouTube extraction)
 */
export function getReducePhaseJsonSchema() {
    return getYouTubeExtractionJsonSchema()
}

/**
 * System prompt for Reduce phase
 */
export function getReducePhaseSystemPrompt(): string {
    return `You are a Content Strategist combining extracted notes into a comprehensive content extraction.

YOUR TASK:
- Synthesize chunk notes into a cohesive extraction
- Remove duplicates and merge similar points
- Create ready-to-use social media content
- Generate platform-specific drafts

RULES:
1. Combine all key points, removing redundancy
2. Merge similar quotes, keeping the best phrasing
3. Create a unified topic list
4. Generate DIVERSE hooks (10-30) from different angles
5. Create READY-TO-POST drafts for each platform
6. All output in English

PLATFORM GUIDELINES:
- Threads: Multi-post format, numbered or 🧵 style
- X/Twitter: Short, punchy, max 280 chars per post
- LinkedIn: Professional, insight-focused, 1-3 paragraphs
- Instagram: Visual-friendly captions with line breaks

Return ONLY valid JSON matching the schema.`
}

/**
 * Build user prompt for Reduce phase
 */
export function buildReducePhasePrompt(
    chunkNotes: ChunkNotes[],
    metadata?: {
        title?: string
        channelTitle?: string
        duration?: string
        totalChunks?: number
    }
): string {
    let prompt = `Combine the following extracted notes into a comprehensive content extraction.\n\n`

    if (metadata) {
        if (metadata.title) prompt += `Video Title: ${metadata.title}\n`
        if (metadata.channelTitle) prompt += `Channel: ${metadata.channelTitle}\n`
        if (metadata.duration) prompt += `Duration: ${metadata.duration}\n`
        if (metadata.totalChunks) prompt += `Total Chunks Processed: ${metadata.totalChunks}\n`
        prompt += '\n'
    }

    prompt += `=== CHUNK NOTES ===\n`

    for (const chunk of chunkNotes) {
        prompt += `\n--- Chunk ${chunk.chunkIndex + 1} ---\n`
        prompt += `Key Points:\n${chunk.keyPoints.map((p) => `• ${p}`).join('\n')}\n\n`

        if (chunk.quotes.length > 0) {
            prompt += `Quotes:\n`
            for (const quote of chunk.quotes) {
                const timestamp = quote.startSec !== null ? ` @${formatTimestamp(quote.startSec)}` : ''
                prompt += `• "${quote.text}"${timestamp}\n`
            }
            prompt += '\n'
        }

        prompt += `Topics: ${chunk.topics.join(', ')}\n`
        prompt += `Hooks: ${chunk.hooks.slice(0, 3).join(' | ')}\n`
    }

    prompt += `\n=== END CHUNK NOTES ===\n\n`

    prompt += `CREATE FINAL EXTRACTION:

1. SUMMARY: 2-3 sentences capturing the video's main message
2. KEY POINTS: 5-15 combined, deduplicated key takeaways
3. HOOKS: 10-30 diverse attention-grabbing openers
   - Different styles: questions, bold statements, statistics, contrarian
4. QUOTES: 3-20 best quotes with timestamps
5. CONTENT ANGLES: 5-15 unique ways to present this content
6. PLATFORM DRAFTS:
   - Threads: 2-5 thread-style posts
   - X: 2-5 tweet-sized posts
   - LinkedIn: 1-3 professional posts
   - Instagram: 1-3 caption-style posts
7. TAGS: 5-25 relevant topics/hashtags
8. TONE: Overall tone (educational, motivational, casual, etc.)
9. LANGUAGE: Detected language code (en, ru, es, etc.)
10. TITLE GUESS: Your best guess at the video title

Synthesize intelligently - don't just concatenate!`

    return prompt
}

function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

