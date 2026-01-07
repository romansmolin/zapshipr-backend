import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { users } from '@/modules/user/entity/user.schema'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'

export type InspirationMetadataSource = 'external' | 'youtube' | 'tiktok' | 'notion' | 'docs'

export type InspirationMetadata = {
    title?: string
    description?: string
    author?: string
    domain?: string
    publishedDate?: string
    thumbnailUrl?: string
    source: InspirationMetadataSource
    youTubeVideoId?: string
    tikTokMediaId?: string
}

export const inspirationType = pgEnum('inspiration_type', ['image', 'link', 'text', 'document'])

export const inspirationStatus = pgEnum('inspiration_status', [
    'processing', // Initial state
    'transcript_fetching', // YouTube: fetching transcript
    'transcript_ready', // YouTube: transcript fetched, ready for extraction
    'extracting', // LLM extraction in progress
    'completed', // Successfully processed
    'failed', // Processing failed
])

export const rawInspirations = pgTable('raw_inspirations', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    type: inspirationType('type').notNull(),

    title: varchar('title', { length: 100 }).notNull(),
    content: text('content'),
    imageUrl: varchar('image_url', { length: 1024 }),
    userDescription: text('user_description'),

    metadata: jsonb('metadata').$type<InspirationMetadata | null>(),
    parsedContent: text('parsed_content'),

    status: inspirationStatus('status').notNull().default('processing'),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type RawInspiration = typeof rawInspirations.$inferSelect
export type InsertRawInspiration = typeof rawInspirations.$inferInsert
