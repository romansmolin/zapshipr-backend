import type { TranscriptSegment } from '../services/transcript-normalizer/transcript-normalizer-service.interface'

/**
 * A chunk of transcript with metadata
 */
export interface TranscriptChunk {
    /** Index of the chunk (0-based) */
    index: number

    /** Text content of the chunk */
    text: string

    /** Estimated token count */
    tokenCount: number

    /** Start time in seconds (from first segment in chunk) */
    startSec: number | null

    /** End time in seconds (from last segment in chunk) */
    endSec: number | null

    /** Number of segments in this chunk */
    segmentCount: number
}

/**
 * Options for chunking
 */
export interface ChunkOptions {
    /** Maximum tokens per chunk (default: 3000) */
    maxTokens?: number

    /** Minimum tokens per chunk to avoid tiny chunks (default: 500) */
    minTokens?: number

    /** Overlap tokens between chunks for context (default: 100) */
    overlapTokens?: number

    /** Whether to preserve segment boundaries (default: true) */
    preserveSegmentBoundaries?: boolean
}

/**
 * Result of chunking operation
 */
export interface ChunkResult {
    /** Array of chunks */
    chunks: TranscriptChunk[]

    /** Total token count across all chunks */
    totalTokens: number

    /** Whether chunking was needed (text was longer than maxTokens) */
    wasChunked: boolean

    /** Original text length in characters */
    originalLength: number
}

/**
 * Estimate token count from text.
 * Uses simple heuristic: ~4 characters per token for English.
 * This is a rough approximation - actual token count depends on the tokenizer.
 */
export function estimateTokenCount(text: string): number {
    if (!text) return 0
    // Average ~4 chars per token for English text
    // Adjust slightly for punctuation and whitespace
    return Math.ceil(text.length / 4)
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries, keeping the delimiter
    const sentences = text.split(/(?<=[.!?])\s+/)
    return sentences.filter((s) => s.trim().length > 0)
}

/**
 * Chunk transcript text without segment information.
 * Splits on sentence boundaries.
 */
export function chunkText(text: string, options: ChunkOptions = {}): ChunkResult {
    const { maxTokens = 3000, minTokens = 500, overlapTokens = 100 } = options

    const totalTokens = estimateTokenCount(text)

    // If text fits in one chunk, return as-is
    if (totalTokens <= maxTokens) {
        return {
            chunks: [
                {
                    index: 0,
                    text: text.trim(),
                    tokenCount: totalTokens,
                    startSec: null,
                    endSec: null,
                    segmentCount: 0,
                },
            ],
            totalTokens,
            wasChunked: false,
            originalLength: text.length,
        }
    }

    const sentences = splitIntoSentences(text)
    const chunks: TranscriptChunk[] = []

    let currentChunkSentences: string[] = []
    let currentTokens = 0
    let chunkIndex = 0

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]
        const sentenceTokens = estimateTokenCount(sentence)

        // If adding this sentence exceeds max, start a new chunk
        if (currentTokens + sentenceTokens > maxTokens && currentChunkSentences.length > 0) {
            // Save current chunk
            const chunkText = currentChunkSentences.join(' ')
            chunks.push({
                index: chunkIndex++,
                text: chunkText,
                tokenCount: estimateTokenCount(chunkText),
                startSec: null,
                endSec: null,
                segmentCount: 0,
            })

            // Start new chunk with overlap
            if (overlapTokens > 0) {
                // Add last few sentences from previous chunk for context
                const overlapSentences: string[] = []
                let overlapCount = 0
                for (let j = currentChunkSentences.length - 1; j >= 0 && overlapCount < overlapTokens; j--) {
                    overlapSentences.unshift(currentChunkSentences[j])
                    overlapCount += estimateTokenCount(currentChunkSentences[j])
                }
                currentChunkSentences = overlapSentences
                currentTokens = overlapCount
            } else {
                currentChunkSentences = []
                currentTokens = 0
            }
        }

        currentChunkSentences.push(sentence)
        currentTokens += sentenceTokens
    }

    // Add remaining sentences as last chunk
    if (currentChunkSentences.length > 0) {
        const chunkText = currentChunkSentences.join(' ')
        const tokenCount = estimateTokenCount(chunkText)

        // If last chunk is too small, merge with previous
        if (tokenCount < minTokens && chunks.length > 0) {
            const lastChunk = chunks[chunks.length - 1]
            lastChunk.text = lastChunk.text + ' ' + chunkText
            lastChunk.tokenCount = estimateTokenCount(lastChunk.text)
        } else {
            chunks.push({
                index: chunkIndex,
                text: chunkText,
                tokenCount,
                startSec: null,
                endSec: null,
                segmentCount: 0,
            })
        }
    }

    return {
        chunks,
        totalTokens,
        wasChunked: true,
        originalLength: text.length,
    }
}

/**
 * Chunk transcript with segment information.
 * Preserves timing boundaries from segments.
 */
export function chunkTranscript(
    segments: TranscriptSegment[],
    options: ChunkOptions = {}
): ChunkResult {
    const { maxTokens = 3000, minTokens = 500 } = options

    if (segments.length === 0) {
        return {
            chunks: [],
            totalTokens: 0,
            wasChunked: false,
            originalLength: 0,
        }
    }

    // Calculate total
    const fullText = segments.map((s) => s.text).join(' ')
    const totalTokens = estimateTokenCount(fullText)

    // If fits in one chunk, return as-is
    if (totalTokens <= maxTokens) {
        return {
            chunks: [
                {
                    index: 0,
                    text: fullText,
                    tokenCount: totalTokens,
                    startSec: segments[0].startSec,
                    endSec: segments[segments.length - 1].endSec,
                    segmentCount: segments.length,
                },
            ],
            totalTokens,
            wasChunked: false,
            originalLength: fullText.length,
        }
    }

    const chunks: TranscriptChunk[] = []
    let currentSegments: TranscriptSegment[] = []
    let currentTokens = 0
    let chunkIndex = 0

    for (const segment of segments) {
        const segmentTokens = estimateTokenCount(segment.text)

        // If adding this segment exceeds max, finalize current chunk
        if (currentTokens + segmentTokens > maxTokens && currentSegments.length > 0) {
            const chunkText = currentSegments.map((s) => s.text).join(' ')
            chunks.push({
                index: chunkIndex++,
                text: chunkText,
                tokenCount: estimateTokenCount(chunkText),
                startSec: currentSegments[0].startSec,
                endSec: currentSegments[currentSegments.length - 1].endSec,
                segmentCount: currentSegments.length,
            })

            currentSegments = []
            currentTokens = 0
        }

        currentSegments.push(segment)
        currentTokens += segmentTokens
    }

    // Add remaining segments
    if (currentSegments.length > 0) {
        const chunkText = currentSegments.map((s) => s.text).join(' ')
        const tokenCount = estimateTokenCount(chunkText)

        // If last chunk is too small, merge with previous
        if (tokenCount < minTokens && chunks.length > 0) {
            const lastChunk = chunks[chunks.length - 1]
            lastChunk.text = lastChunk.text + ' ' + chunkText
            lastChunk.tokenCount = estimateTokenCount(lastChunk.text)
            lastChunk.endSec = currentSegments[currentSegments.length - 1].endSec
            lastChunk.segmentCount += currentSegments.length
        } else {
            chunks.push({
                index: chunkIndex,
                text: chunkText,
                tokenCount,
                startSec: currentSegments[0].startSec,
                endSec: currentSegments[currentSegments.length - 1].endSec,
                segmentCount: currentSegments.length,
            })
        }
    }

    return {
        chunks,
        totalTokens,
        wasChunked: chunks.length > 1,
        originalLength: fullText.length,
    }
}

/**
 * Check if text needs chunking based on token count
 */
export function needsChunking(text: string, maxTokens: number = 3000): boolean {
    return estimateTokenCount(text) > maxTokens
}

