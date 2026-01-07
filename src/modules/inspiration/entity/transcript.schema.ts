import { pgTable, uuid, text, varchar, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { rawInspirations } from './raw-inspiration.schema'

/**
 * Source of the transcript
 */
export const transcriptSource = pgEnum('transcript_source', ['human_captions', 'auto_captions', 'stt'])

/**
 * Format of the raw transcript data
 */
export const transcriptFormat = pgEnum('transcript_format', ['vtt', 'srt', 'text', 'json_segments'])

/**
 * Transcript segment with timing information
 */
export interface TranscriptSegment {
    startSec: number
    endSec: number
    text: string
}

/**
 * Transcripts table - stores video transcripts for inspirations
 */
export const transcripts = pgTable('transcripts', {
    id: uuid('id').defaultRandom().primaryKey(),

    /** Reference to the inspiration this transcript belongs to */
    inspirationId: uuid('inspiration_id')
        .notNull()
        .references(() => rawInspirations.id, { onDelete: 'cascade' }),

    /** YouTube video ID for caching/deduplication */
    videoId: varchar('video_id', { length: 20 }),

    /** Language code (e.g., 'en', 'ru', 'es') */
    language: varchar('language', { length: 10 }),

    /** Source of the transcript */
    source: transcriptSource('source').notNull(),

    /** Original format of the transcript */
    format: transcriptFormat('format').notNull(),

    /** Raw transcript data (VTT/SRT/text) */
    raw: text('raw').notNull(),

    /** Normalized plain text (cleaned, no timestamps) */
    normalizedText: text('normalized_text'),

    /** Parsed segments with timing (for quotes with timestamps) */
    segments: jsonb('segments').$type<TranscriptSegment[] | null>(),

    /** Duration of the video in seconds (for reference) */
    durationSec: varchar('duration_sec', { length: 20 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Transcript = typeof transcripts.$inferSelect
export type InsertTranscript = typeof transcripts.$inferInsert

