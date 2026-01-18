import {
    estimateTokenCount,
    chunkText,
    chunkTranscript,
    needsChunking,
    type TranscriptChunk,
} from '../transcript-chunker'
import type { TranscriptSegment } from '../../services/transcript-normalizer/transcript-normalizer-service.interface'

describe('estimateTokenCount', () => {
    it('should return 0 for empty string', () => {
        expect(estimateTokenCount('')).toBe(0)
    })

    it('should estimate tokens based on character count', () => {
        // ~4 chars per token
        expect(estimateTokenCount('Hello world')).toBe(3) // 11 chars → ~3 tokens
        expect(estimateTokenCount('This is a longer sentence with more words.')).toBe(11) // 43 chars → ~11 tokens
    })

    it('should handle long text', () => {
        const longText = 'word '.repeat(1000) // ~5000 chars
        const tokens = estimateTokenCount(longText)
        expect(tokens).toBeGreaterThan(1000)
        expect(tokens).toBeLessThan(2000)
    })
})

describe('needsChunking', () => {
    it('should return false for short text', () => {
        expect(needsChunking('Hello world', 3000)).toBe(false)
    })

    it('should return true for long text', () => {
        const longText = 'word '.repeat(5000) // ~25000 chars → ~6250 tokens
        expect(needsChunking(longText, 3000)).toBe(true)
    })

    it('should use default maxTokens', () => {
        const mediumText = 'word '.repeat(2000) // ~10000 chars → ~2500 tokens
        expect(needsChunking(mediumText)).toBe(false)

        const longText = 'word '.repeat(4000) // ~20000 chars → ~5000 tokens
        expect(needsChunking(longText)).toBe(true)
    })
})

describe('chunkText', () => {
    it('should return single chunk for short text', () => {
        const text = 'This is a short text.'
        const result = chunkText(text, { maxTokens: 3000 })

        expect(result.wasChunked).toBe(false)
        expect(result.chunks).toHaveLength(1)
        expect(result.chunks[0].text).toBe(text)
        expect(result.chunks[0].index).toBe(0)
    })

    it('should split long text into multiple chunks', () => {
        // Create text that's definitely > 3000 tokens
        const sentences = []
        for (let i = 0; i < 100; i++) {
            sentences.push(`This is sentence number ${i} with some additional words to make it longer.`)
        }
        const longText = sentences.join(' ')

        const result = chunkText(longText, { maxTokens: 500, minTokens: 100 })

        expect(result.wasChunked).toBe(true)
        expect(result.chunks.length).toBeGreaterThan(1)

        // Each chunk should be under maxTokens
        for (const chunk of result.chunks) {
            expect(chunk.tokenCount).toBeLessThanOrEqual(600) // Some tolerance
        }

        // Chunks should be indexed correctly
        result.chunks.forEach((chunk, i) => {
            expect(chunk.index).toBe(i)
        })
    })

    it('should preserve sentence boundaries', () => {
        const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.'
        const result = chunkText(text, { maxTokens: 10, minTokens: 1, overlapTokens: 0 })

        // Each chunk should end with a complete sentence
        for (const chunk of result.chunks) {
            expect(chunk.text.endsWith('.') || chunk.text.endsWith('!') || chunk.text.endsWith('?')).toBe(
                true
            )
        }
    })

    it('should handle text without timing info', () => {
        const text = 'Some text without segments.'
        const result = chunkText(text)

        expect(result.chunks[0].startSec).toBeNull()
        expect(result.chunks[0].endSec).toBeNull()
        expect(result.chunks[0].segmentCount).toBe(0)
    })
})

describe('chunkTranscript', () => {
    it('should return empty result for empty segments', () => {
        const result = chunkTranscript([])

        expect(result.chunks).toHaveLength(0)
        expect(result.totalTokens).toBe(0)
        expect(result.wasChunked).toBe(false)
    })

    it('should return single chunk for short transcript', () => {
        const segments: TranscriptSegment[] = [
            { startSec: 0, endSec: 2, text: 'Hello world' },
            { startSec: 2, endSec: 5, text: 'This is a test' },
        ]

        const result = chunkTranscript(segments, { maxTokens: 3000 })

        expect(result.wasChunked).toBe(false)
        expect(result.chunks).toHaveLength(1)
        expect(result.chunks[0].startSec).toBe(0)
        expect(result.chunks[0].endSec).toBe(5)
        expect(result.chunks[0].segmentCount).toBe(2)
    })

    it('should preserve timing across chunks', () => {
        const segments: TranscriptSegment[] = []
        for (let i = 0; i < 50; i++) {
            segments.push({
                startSec: i * 10,
                endSec: (i + 1) * 10,
                text: `This is segment number ${i} with some content to fill it up nicely.`,
            })
        }

        const result = chunkTranscript(segments, { maxTokens: 200, minTokens: 50 })

        expect(result.wasChunked).toBe(true)
        expect(result.chunks.length).toBeGreaterThan(1)

        // First chunk should start at 0
        expect(result.chunks[0].startSec).toBe(0)

        // Last chunk should end at the last segment's end
        const lastChunk = result.chunks[result.chunks.length - 1]
        expect(lastChunk.endSec).toBe(500)

        // Chunks should be continuous (no gaps in timing)
        for (let i = 1; i < result.chunks.length; i++) {
            const prevChunk = result.chunks[i - 1]
            const currentChunk = result.chunks[i]
            // Current chunk should start where previous ended or after
            expect(currentChunk.startSec).toBeGreaterThanOrEqual(prevChunk.endSec!)
        }
    })

    it('should respect maxTokens limit', () => {
        const segments: TranscriptSegment[] = []
        for (let i = 0; i < 100; i++) {
            segments.push({
                startSec: i,
                endSec: i + 1,
                text: 'This is a fairly long sentence that takes up some tokens in the chunk.',
            })
        }

        const result = chunkTranscript(segments, { maxTokens: 300 })

        // Each chunk should be under maxTokens (with some tolerance for segment boundaries)
        for (const chunk of result.chunks) {
            expect(chunk.tokenCount).toBeLessThanOrEqual(400)
        }
    })

    it('should merge small trailing chunks', () => {
        const segments: TranscriptSegment[] = [
            { startSec: 0, endSec: 10, text: 'word '.repeat(100) }, // ~500 chars → ~125 tokens
            { startSec: 10, endSec: 20, text: 'word '.repeat(100) },
            { startSec: 20, endSec: 30, text: 'Hi' }, // Very small
        ]

        const result = chunkTranscript(segments, { maxTokens: 200, minTokens: 50 })

        // The tiny last segment should be merged
        const lastChunk = result.chunks[result.chunks.length - 1]
        expect(lastChunk.text).toContain('Hi')
        expect(lastChunk.endSec).toBe(30)
    })

    it('should count segments correctly', () => {
        const segments: TranscriptSegment[] = [
            { startSec: 0, endSec: 1, text: 'One' },
            { startSec: 1, endSec: 2, text: 'Two' },
            { startSec: 2, endSec: 3, text: 'Three' },
        ]

        const result = chunkTranscript(segments, { maxTokens: 3000 })

        expect(result.chunks[0].segmentCount).toBe(3)
    })
})

