import type { DocumentChunkNotes } from './document-map-prompt'

export function getDocumentReduceSystemPrompt(): string {
    return `You are synthesizing semantic notes from a long-form document into a single extraction.

RULES:
1. Deduplicate and merge overlapping ideas
2. Infer the document type (book, article, report, legal, manual, whitepaper, research, other)
3. Provide actionable, reusable insights with clear reasoning
4. Do not invent facts or quotes
5. Use "Not specified in the document" if evidence is missing
6. Output valid JSON only that matches the schema`
}

export function buildDocumentReducePrompt(
    chunkNotes: DocumentChunkNotes[],
    metadata?: {
        title?: string
        author?: string
        userDescription?: string
        domain?: string
    }
): string {
    let prompt = `Synthesize the following chunk notes into a single structured extraction.\n\n`

    if (metadata) {
        prompt += `Metadata:\n${JSON.stringify(metadata, null, 2)}\n\n`
    }

    prompt += `=== CHUNK NOTES (JSON) ===\n${JSON.stringify(chunkNotes, null, 2)}\n=== END NOTES ===\n\n`

    prompt += `Return a single JSON object that:
- Provides semantic understanding (no raw text dumps)
- Includes core ideas, repeated themes, mental models, author intent, narrative flow, mood/tone
- Produces key insights with why they work and cause-effect relationships
- Adds use-case ready insights for reuse in content and knowledge work`

    return prompt
}
