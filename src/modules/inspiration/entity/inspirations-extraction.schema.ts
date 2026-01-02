import { pgTable, uuid, text, varchar, timestamp, integer } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'
import { rawInspirations } from './raw-inspiration.schema'

export const inspirationsExtractions = pgTable('inspirations_extractions', {
    id: uuid('id').defaultRandom().primaryKey(),
    rawInspirationId: uuid('raw_inspiration_id')
        .notNull()
        .references(() => rawInspirations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, { onDelete: 'cascade' }),

    // Структура для LLM (оптимизирована для AI)
    summary: text('summary').notNull(), // Краткое описание (2-3 предложения)
    keyTopics: text('key_topics')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`), // ["marketing", "storytelling"]
    contentFormat: varchar('content_format', { length: 50 }), // "video", "article", etc
    tone: text('tone')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`), // ["professional", "casual"]
    targetAudience: text('target_audience'), // "B2B marketers"
    keyInsights: text('key_insights')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`), // Ключевые идеи/takeaways
    contentStructure: text('content_structure'), // Описание структуры
    visualStyle: text('visual_style'), // Визуальный стиль (если есть)
    suggestedTags: text('suggested_tags')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`), // Предложенные теги

    // Мета
    llmModel: varchar('llm_model', { length: 50 }), // Модель OpenAI
    tokensUsed: integer('tokens_used'), // Количество токенов

    createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type InspirationsExtraction = typeof inspirationsExtractions.$inferSelect
export type InsertInspirationsExtraction = typeof inspirationsExtractions.$inferInsert

