/**
 * Map Phase: Extract semantic notes from a document chunk
 */

export interface DocumentChunkNotes {
    chunkIndex: number
    coreIdeas: string[]
    keyInsights: Array<{
        insight: string
        whyItWorks: string
        causeEffect: string
        evidence: string
    }>
    mentalModels: Array<{
        name: string
        description: string
        steps: string[]
    }>
    themes: string[]
    narrativeNotes: string[]
    authorIntentHints: string[]
    toneHints: string[]
}

/**
 * JSON Schema for document chunk notes
 */
export function getDocumentMapJsonSchema() {
    return {
        name: 'document_chunk_notes_v1',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                coreIdeas: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-5 core ideas expressed in this chunk',
                },
                keyInsights: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            insight: { type: 'string' },
                            whyItWorks: { type: 'string' },
                            causeEffect: { type: 'string' },
                            evidence: { type: 'string' },
                        },
                        required: ['insight', 'whyItWorks', 'causeEffect', 'evidence'],
                    },
                    description: '2-4 key insights with reasoning and evidence',
                },
                mentalModels: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            name: { type: 'string' },
                            description: { type: 'string' },
                            steps: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['name', 'description', 'steps'],
                    },
                    description: '0-3 mental models or frameworks mentioned',
                },
                themes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-4 themes in this chunk',
                },
                narrativeNotes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '1-3 notes about how the argument advances',
                },
                authorIntentHints: {
                    type: 'array',
                    items: { type: 'string' },
                    description: "Hints about the author's intent or philosophy",
                },
                toneHints: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Tone indicators from this chunk',
                },
            },
            required: [
                'coreIdeas',
                'keyInsights',
                'mentalModels',
                'themes',
                'narrativeNotes',
                'authorIntentHints',
                'toneHints',
            ],
        },
    }
}

/**
 * System prompt for document chunk analysis
 */
export function getDocumentMapSystemPrompt(): string {
    return `You are extracting semantic notes from a chunk of a long-form document.

RULES:
1. Focus on meaning and frameworks, not raw text or headings
2. Keep outputs short and specific
3. Use "Not specified in the document" when evidence is missing
4. Do not invent facts
5. Output valid JSON only`
}

/**
 * Build user prompt for document chunk analysis
 */
export function buildDocumentMapPrompt(
    chunkText: string,
    chunkIndex: number,
    totalChunks: number
): string {
    let prompt = `Extract semantic notes from this document chunk.\n\n`

    prompt += `Chunk ${chunkIndex + 1} of ${totalChunks}\n\n`
    prompt += `=== DOCUMENT CHUNK ===\n${chunkText}\n=== END CHUNK ===\n\n`

    prompt += `Extract:
1. 2-5 core ideas
2. 2-4 key insights with why they work and cause-effect links
3. 0-3 mental models or frameworks with steps
4. 2-4 themes
5. 1-3 narrative notes about how the argument advances
6. Author intent hints
7. Tone hints

Be specific to this chunk's content.`

    return prompt
}
