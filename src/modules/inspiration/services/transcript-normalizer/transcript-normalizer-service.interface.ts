/**
 * A segment of transcript with timing information
 */
export interface TranscriptSegment {
    /** Start time in seconds */
    startSec: number

    /** End time in seconds */
    endSec: number

    /** Text content of the segment */
    text: string
}

/**
 * Result of transcript normalization
 */
export interface NormalizedTranscript {
    /** Clean, normalized text without timestamps */
    normalizedText: string

    /** Segments with timing information */
    segments: TranscriptSegment[]

    /** Detected or specified language */
    language: string | null

    /** Original format of the transcript */
    originalFormat: 'vtt' | 'srt' | 'text' | 'unknown'

    /** Statistics about the normalization */
    stats: {
        /** Number of segments */
        segmentCount: number

        /** Total duration in seconds */
        totalDurationSec: number

        /** Character count of normalized text */
        characterCount: number

        /** Word count of normalized text */
        wordCount: number

        /** Number of duplicate phrases removed */
        duplicatesRemoved: number
    }
}

/**
 * Options for transcript normalization
 */
export interface NormalizeOptions {
    /** Remove duplicate consecutive phrases (common in auto-captions) */
    removeDuplicates?: boolean

    /** Minimum similarity threshold for duplicate detection (0-1) */
    duplicateThreshold?: number

    /** Language hint for better processing */
    languageHint?: string
}

/**
 * Service for parsing and normalizing transcripts
 */
export interface ITranscriptNormalizerService {
    /**
     * Parse and normalize a VTT transcript
     */
    parseVTT(content: string, options?: NormalizeOptions): NormalizedTranscript

    /**
     * Parse and normalize an SRT transcript
     */
    parseSRT(content: string, options?: NormalizeOptions): NormalizedTranscript

    /**
     * Parse and normalize plain text (no timing info)
     */
    parseText(content: string, options?: NormalizeOptions): NormalizedTranscript

    /**
     * Auto-detect format and parse
     */
    parse(content: string, options?: NormalizeOptions): NormalizedTranscript

    /**
     * Normalize already parsed segments
     */
    normalizeSegments(segments: TranscriptSegment[], options?: NormalizeOptions): TranscriptSegment[]
}

