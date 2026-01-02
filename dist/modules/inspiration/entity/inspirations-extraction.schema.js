"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspirationsExtractions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const workspace_schema_1 = require("@/modules/workspace/entity/workspace.schema");
const raw_inspiration_schema_1 = require("./raw-inspiration.schema");
exports.inspirationsExtractions = (0, pg_core_1.pgTable)('inspirations_extractions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    rawInspirationId: (0, pg_core_1.uuid)('raw_inspiration_id')
        .notNull()
        .references(() => raw_inspiration_schema_1.rawInspirations.id, { onDelete: 'cascade' }),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => workspace_schema_1.workspaces.id, { onDelete: 'cascade' }),
    summary: (0, pg_core_1.text)('summary').notNull(),
    keyTopics: (0, pg_core_1.text)('key_topics')
        .array()
        .notNull()
        .default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`),
    contentFormat: (0, pg_core_1.varchar)('content_format', { length: 50 }), // "video", "article", etc
    tone: (0, pg_core_1.text)('tone')
        .array()
        .notNull()
        .default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`), // ["professional", "casual"]
    targetAudience: (0, pg_core_1.text)('target_audience'), // "B2B marketers"
    keyInsights: (0, pg_core_1.text)('key_insights')
        .array()
        .notNull()
        .default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`), // Ключевые идеи/takeaways
    contentStructure: (0, pg_core_1.text)('content_structure'), // Описание структуры
    visualStyle: (0, pg_core_1.text)('visual_style'), // Визуальный стиль (если есть)
    suggestedTags: (0, pg_core_1.text)('suggested_tags')
        .array()
        .notNull()
        .default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`), // Предложенные теги
    // Мета
    llmModel: (0, pg_core_1.varchar)('llm_model', { length: 50 }), // Модель OpenAI
    tokensUsed: (0, pg_core_1.integer)('tokens_used'), // Количество токенов
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
