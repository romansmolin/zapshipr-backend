import type {
    ITranscriptNormalizerService,
    NormalizedTranscript,
    TranscriptSegment,
    NormalizeOptions,
} from './transcript-normalizer-service.interface'

export class TranscriptNormalizerService implements ITranscriptNormalizerService {
    /**
     * Parse VTT format transcript
     * Format:
     * WEBVTT
     *
     * 00:00:00.000 --> 00:00:02.500
     * Hello world
     *
     * 00:00:02.500 --> 00:00:05.000
     * This is a test
     */
    parseVTT(content: string, options: NormalizeOptions = {}): NormalizedTranscript {
        const lines = content.split('\n')
        const segments: TranscriptSegment[] = []

        let i = 0

        // Skip WEBVTT header and any metadata
        while (i < lines.length && !lines[i].includes('-->')) {
            i++
        }

        // Parse cues
        while (i < lines.length) {
            const line = lines[i].trim()

            // Look for timing line (contains -->)
            if (line.includes('-->')) {
                const timing = this.parseVTTTiming(line)

                if (timing) {
                    // Collect text lines until empty line or next timing
                    const textLines: string[] = []
                    i++

                    while (i < lines.length) {
                        const textLine = lines[i].trim()
                        if (textLine === '' || textLine.includes('-->')) {
                            break
                        }
                        // Add text line (clean it)
                        textLines.push(this.cleanVTTText(textLine))
                        i++
                    }

                    if (textLines.length > 0) {
                        segments.push({
                            startSec: timing.startSec,
                            endSec: timing.endSec,
                            text: textLines.join(' ').trim(),
                        })
                    }
                } else {
                    i++
                }
            } else {
                i++
            }
        }

        return this.buildNormalizedTranscript(segments, 'vtt', options)
    }

    /**
     * Parse SRT format transcript
     * Format:
     * 1
     * 00:00:00,000 --> 00:00:02,500
     * Hello world
     *
     * 2
     * 00:00:02,500 --> 00:00:05,000
     * This is a test
     */
    parseSRT(content: string, options: NormalizeOptions = {}): NormalizedTranscript {
        const lines = content.split('\n')
        const segments: TranscriptSegment[] = []

        let i = 0

        while (i < lines.length) {
            const line = lines[i].trim()

            // Skip sequence numbers
            if (line.match(/^\d+$/)) {
                i++
                continue
            }

            // Look for timing line
            if (line.includes('-->')) {
                const timing = this.parseSRTTiming(line)

                if (timing) {
                    const textLines: string[] = []
                    i++

                    // Collect text until empty line
                    while (i < lines.length && lines[i].trim() !== '') {
                        const textLine = lines[i].trim()
                        // Skip if it's a number (next sequence)
                        if (!textLine.match(/^\d+$/)) {
                            textLines.push(this.cleanSRTText(textLine))
                        } else {
                            break
                        }
                        i++
                    }

                    if (textLines.length > 0) {
                        segments.push({
                            startSec: timing.startSec,
                            endSec: timing.endSec,
                            text: textLines.join(' ').trim(),
                        })
                    }
                } else {
                    i++
                }
            } else {
                i++
            }
        }

        return this.buildNormalizedTranscript(segments, 'srt', options)
    }

    /**
     * Parse plain text (no timing information)
     */
    parseText(content: string, options: NormalizeOptions = {}): NormalizedTranscript {
        const cleanedText = this.normalizeWhitespace(content)

        // Create a single segment for the entire text
        const segments: TranscriptSegment[] = [
            {
                startSec: 0,
                endSec: 0,
                text: cleanedText,
            },
        ]

        return this.buildNormalizedTranscript(segments, 'text', options)
    }

    /**
     * Auto-detect format and parse
     */
    parse(content: string, options: NormalizeOptions = {}): NormalizedTranscript {
        const trimmedContent = content.trim()

        // Detect VTT
        if (trimmedContent.startsWith('WEBVTT') || trimmedContent.includes('WEBVTT')) {
            return this.parseVTT(content, options)
        }

        // Detect SRT (starts with number, then timing with comma for milliseconds)
        if (trimmedContent.match(/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->/)) {
            return this.parseSRT(content, options)
        }

        // Check for VTT-style timing without header
        if (trimmedContent.match(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/)) {
            return this.parseVTT(content, options)
        }

        // Check for SRT-style timing
        if (trimmedContent.match(/\d{2}:\d{2}:\d{2},\d{3}\s*-->/)) {
            return this.parseSRT(content, options)
        }

        // Default to plain text
        return this.parseText(content, options)
    }

    /**
     * Normalize segments (remove duplicates, clean text)
     */
    normalizeSegments(segments: TranscriptSegment[], options: NormalizeOptions = {}): TranscriptSegment[] {
        const { removeDuplicates = true, duplicateThreshold = 0.8 } = options

        let normalized = segments.map((seg) => ({
            ...seg,
            text: this.normalizeWhitespace(seg.text),
        }))

        // Remove empty segments
        normalized = normalized.filter((seg) => seg.text.length > 0)

        // Remove duplicate consecutive phrases
        if (removeDuplicates) {
            normalized = this.removeDuplicateSegments(normalized, duplicateThreshold)
        }

        return normalized
    }

    /**
     * Parse VTT timing line: 00:00:00.000 --> 00:00:02.500
     */
    private parseVTTTiming(line: string): { startSec: number; endSec: number } | null {
        // VTT format: HH:MM:SS.mmm --> HH:MM:SS.mmm or MM:SS.mmm --> MM:SS.mmm
        const match = line.match(
            /(\d{1,2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})\.(\d{3})/
        )

        if (!match) return null

        const startHours = match[1] ? parseInt(match[1].replace(':', ''), 10) : 0
        const startMinutes = parseInt(match[2], 10)
        const startSeconds = parseInt(match[3], 10)
        const startMs = parseInt(match[4], 10)

        const endHours = match[5] ? parseInt(match[5].replace(':', ''), 10) : 0
        const endMinutes = parseInt(match[6], 10)
        const endSeconds = parseInt(match[7], 10)
        const endMs = parseInt(match[8], 10)

        const startSec = startHours * 3600 + startMinutes * 60 + startSeconds + startMs / 1000
        const endSec = endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000

        return { startSec, endSec }
    }

    /**
     * Parse SRT timing line: 00:00:00,000 --> 00:00:02,500
     */
    private parseSRTTiming(line: string): { startSec: number; endSec: number } | null {
        // SRT format: HH:MM:SS,mmm --> HH:MM:SS,mmm
        const match = line.match(
            /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
        )

        if (!match) return null

        const startHours = parseInt(match[1], 10)
        const startMinutes = parseInt(match[2], 10)
        const startSeconds = parseInt(match[3], 10)
        const startMs = parseInt(match[4], 10)

        const endHours = parseInt(match[5], 10)
        const endMinutes = parseInt(match[6], 10)
        const endSeconds = parseInt(match[7], 10)
        const endMs = parseInt(match[8], 10)

        const startSec = startHours * 3600 + startMinutes * 60 + startSeconds + startMs / 1000
        const endSec = endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000

        return { startSec, endSec }
    }

    /**
     * Clean VTT text (remove tags, styling)
     */
    private cleanVTTText(text: string): string {
        return (
            text
                // Remove VTT tags like <c>, </c>, <v Speaker>, etc.
                .replace(/<[^>]+>/g, '')
                // Remove VTT positioning like align:start position:0%
                .replace(/align:\w+/g, '')
                .replace(/position:\d+%/g, '')
                // Remove timestamps in text
                .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
                .trim()
        )
    }

    /**
     * Clean SRT text (remove tags)
     */
    private cleanSRTText(text: string): string {
        return (
            text
                // Remove HTML-style tags
                .replace(/<[^>]+>/g, '')
                // Remove font tags
                .replace(/\{[^}]+\}/g, '')
                .trim()
        )
    }

    /**
     * Normalize whitespace in text
     */
    private normalizeWhitespace(text: string): string {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    }

    /**
     * Remove duplicate consecutive segments
     */
    private removeDuplicateSegments(
        segments: TranscriptSegment[],
        threshold: number
    ): TranscriptSegment[] {
        if (segments.length === 0) return segments

        const result: TranscriptSegment[] = [segments[0]]

        for (let i = 1; i < segments.length; i++) {
            const current = segments[i]
            const previous = result[result.length - 1]

            // Check similarity
            const similarity = this.calculateSimilarity(
                current.text.toLowerCase(),
                previous.text.toLowerCase()
            )

            if (similarity < threshold) {
                result.push(current)
            } else {
                // Merge timing if duplicate
                previous.endSec = Math.max(previous.endSec, current.endSec)
            }
        }

        return result
    }

    /**
     * Calculate similarity between two strings (0-1)
     */
    private calculateSimilarity(a: string, b: string): number {
        if (a === b) return 1
        if (a.length === 0 || b.length === 0) return 0

        // Simple containment check
        if (a.includes(b) || b.includes(a)) {
            return Math.min(a.length, b.length) / Math.max(a.length, b.length)
        }

        // Jaccard similarity on words
        const wordsA = new Set(a.split(/\s+/))
        const wordsB = new Set(b.split(/\s+/))

        const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)))
        const union = new Set([...wordsA, ...wordsB])

        return intersection.size / union.size
    }

    /**
     * Build the final normalized transcript result
     */
    private buildNormalizedTranscript(
        segments: TranscriptSegment[],
        format: 'vtt' | 'srt' | 'text' | 'unknown',
        options: NormalizeOptions
    ): NormalizedTranscript {
        const originalCount = segments.length
        const normalizedSegments = this.normalizeSegments(segments, options)
        const duplicatesRemoved = originalCount - normalizedSegments.length

        // Build normalized text
        const normalizedText = normalizedSegments.map((s) => s.text).join(' ')

        // Calculate stats
        const totalDurationSec =
            normalizedSegments.length > 0
                ? Math.max(...normalizedSegments.map((s) => s.endSec)) -
                  Math.min(...normalizedSegments.map((s) => s.startSec))
                : 0

        const wordCount = normalizedText.split(/\s+/).filter((w) => w.length > 0).length

        return {
            normalizedText,
            segments: normalizedSegments,
            language: options.languageHint || null,
            originalFormat: format,
            stats: {
                segmentCount: normalizedSegments.length,
                totalDurationSec,
                characterCount: normalizedText.length,
                wordCount,
                duplicatesRemoved,
            },
        }
    }
}

