import { pgTable, uuid, text, varchar, timestamp, integer, jsonb, real } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'
import { rawInspirations } from './raw-inspiration.schema'

// === TypeScript Interfaces ===

export interface BookIdentification {
    title: string
    authors: string[]
    isbn?: string
    isbn13?: string
    publicationYear?: number
    publisher?: string
    genre: string[]
    category: string // business, self-help, fiction, psychology, etc.
    language?: string
    pageCount?: number
    confidence: number // 0-1, confidence in book identification
}

export interface SemanticCore {
    coreThesis: string // Main idea of the book in 1-2 sentences
    philosophy: string // Author's worldview/philosophy
    keyArguments: string[] // 5-7 key arguments
    frameworks: BookFramework[] // Methodologies/frameworks from the book
    memorableQuotes: string[] // Memorable quotes/ideas
}

export interface BookFramework {
    name: string
    description: string
    application: string // How to apply this framework
}

export interface ThemesAndPatterns {
    primaryThemes: string[] // Main themes
    secondaryThemes: string[] // Secondary themes
    narrativeStyle: string // Narrative style
    tone: string[] // Book tone
    targetReader: string // Who the book is written for
    problemsSolved: string[] // What problems the book solves
}

export interface KnowledgeConnections {
    relatedBooks: string[] // Similar books
    influences: string[] // What influenced the book
    opposingViews: string[] // Opposing viewpoints
    buildsUpon: string[] // What concepts it builds upon
}

export interface ContentInsight {
    insight: string
    hook: string // Suggested hook for social media
    contentAngle: string // Angle for content creation
    suggestedFormat: string // carousel, thread, video, etc.
}

export interface ContentGenerationGuidelines {
    keyInsightsForPosts: ContentInsight[]
    contentFormats: string[] // Suitable formats
    callToActions: string[]
    hashtags: string[]
    audienceHooks: string[] // What will grab audience attention
}

export interface ProcessingMeta {
    llmModel: string
    tokensUsed: number
    visionUsed: boolean
    externalSourcesUsed: string[] // google_books, open_library, etc.
    processingDurationMs: number
}

// Full book extraction interface
export interface BookExtractionData {
    identification: BookIdentification
    semanticCore: SemanticCore
    themesAndPatterns: ThemesAndPatterns
    knowledgeConnections: KnowledgeConnections
    contentGenerationGuidelines: ContentGenerationGuidelines
    processingMeta: ProcessingMeta
}

// === Database Schema ===

export const bookExtractions = pgTable('book_extractions', {
    id: uuid('id').defaultRandom().primaryKey(),
    rawInspirationId: uuid('raw_inspiration_id')
        .notNull()
        .references(() => rawInspirations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, { onDelete: 'cascade' }),

    // === IDENTIFICATION ===
    title: varchar('title', { length: 500 }).notNull(),
    authors: text('authors')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
    isbn: varchar('isbn', { length: 20 }),
    isbn13: varchar('isbn13', { length: 20 }),
    publicationYear: integer('publication_year'),
    publisher: varchar('publisher', { length: 255 }),
    genre: text('genre')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
    category: varchar('category', { length: 100 }),
    language: varchar('language', { length: 10 }),
    pageCount: integer('page_count'),
    identificationConfidence: real('identification_confidence'), // 0-1

    // === SEMANTIC CORE (stored as JSONB for flexibility) ===
    semanticCore: jsonb('semantic_core').$type<SemanticCore>().notNull(),

    // === THEMES AND PATTERNS ===
    themesAndPatterns: jsonb('themes_and_patterns').$type<ThemesAndPatterns>().notNull(),

    // === KNOWLEDGE CONNECTIONS ===
    knowledgeConnections: jsonb('knowledge_connections').$type<KnowledgeConnections>().notNull(),

    // === CONTENT GENERATION ===
    contentGenerationGuidelines: jsonb('content_generation_guidelines')
        .$type<ContentGenerationGuidelines>()
        .notNull(),

    // === PROCESSING META ===
    llmModel: varchar('llm_model', { length: 50 }),
    tokensUsed: integer('tokens_used'),
    visionUsed: integer('vision_used').default(0), // 0 = false, 1 = true (for DB compatibility)
    externalSourcesUsed: text('external_sources_used')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
    processingDurationMs: integer('processing_duration_ms'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type BookExtraction = typeof bookExtractions.$inferSelect
export type InsertBookExtraction = typeof bookExtractions.$inferInsert
