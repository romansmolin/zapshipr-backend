/**
 * Map Phase: Extract structured notes from a single transcript chunk
 */

export interface ChunkNotes {
    chunkIndex: number
    keyPoints: string[]
    quotes: Array<{
        text: string
        startSec: number | null
    }>
    topics: string[]
    hooks: string[]
}

/**
 * JSON Schema for Map phase output
 */
export function getMapPhaseJsonSchema() {
    return {
        name: 'chunk_notes_v1',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                keyPoints: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 3-7 key points from this chunk',
                },
                quotes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            text: { type: 'string', description: 'The quote text' },
                            startSec: {
                                type: ['number', 'null'],
                                description: 'Approximate timestamp in seconds (null if unknown)',
                            },
                        },
                        required: ['text', 'startSec'],
                    },
                    description: 'Array of 1-5 notable quotes with timestamps',
                },
                topics: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 2-5 topics/themes discussed in this chunk',
                },
                hooks: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 2-5 potential hooks for social posts',
                },
            },
            required: ['keyPoints', 'quotes', 'topics', 'hooks'],
        },
    }
}

/**
 * System prompt for Map phase
 */
export function getMapPhaseSystemPrompt(): string {
    return `You are a Content Analyst extracting structured notes from video transcript chunks.

YOUR TASK:
- Extract KEY POINTS that capture the main ideas
- Identify NOTABLE QUOTES that are memorable/shareable
- Identify TOPICS/THEMES discussed
- Generate potential HOOKS for social posts

RULES:
1. Work ONLY with the provided transcript chunk
2. Be SPECIFIC - use actual names, numbers, frameworks
3. Quotes should preserve original phrasing
4. Include approximate timestamps if context suggests them
5. Focus on extractable, actionable insights
6. All output in English

Return ONLY valid JSON matching the schema.`
}

/**
 * Build user prompt for Map phase
 */
export function buildMapPhasePrompt(
    chunkText: string,
    chunkIndex: number,
    totalChunks: number,
    startSec: number | null,
    endSec: number | null
): string {
    let prompt = `Extract structured notes from this video transcript chunk.\n\n`

    prompt += `Chunk ${chunkIndex + 1} of ${totalChunks}`
    if (startSec !== null && endSec !== null) {
        prompt += ` (${formatTimestamp(startSec)} - ${formatTimestamp(endSec)})`
    }
    prompt += '\n\n'

    prompt += `=== TRANSCRIPT CHUNK ===\n${chunkText}\n=== END CHUNK ===\n\n`

    prompt += `EXTRACT:
1. 3-7 KEY POINTS - main ideas, arguments, takeaways
2. 1-5 QUOTES - memorable statements (estimate timestamps based on chunk position)
3. 2-5 TOPICS - themes discussed
4. 2-5 HOOKS - potential social post opening lines

Be specific to this chunk's actual content.`

    return prompt
}

function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

