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

export type DetectedContentCategory = 'book' | 'article' | 'video' | 'social_post' | 'podcast' | 'course' | 'other'

export type BookMetadata = {
    title: string
    authors: string[]
    isbn?: string
    isbn13?: string
    publisher?: string
    publishedDate?: string
    pageCount?: number
    categories?: string[]
    language?: string
    description?: string
    thumbnailUrl?: string
    previewLink?: string
    infoLink?: string
    averageRating?: number
    ratingsCount?: number
    identificationConfidence?: number
    dataSource?: 'google_books' | 'open_library' | 'manual' | 'vision_ocr'
}

export const inspirationType = pgEnum('inspiration_type', ['image', 'link', 'text', 'document'])

export const inspirationStatus = pgEnum('inspiration_status', ['processing', 'completed', 'failed'])

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
    bookMetadata: jsonb('book_metadata').$type<BookMetadata | null>(),
    detectedCategory: varchar('detected_category', { length: 50 }).$type<DetectedContentCategory | null>(),
    parsedContent: text('parsed_content'),

    status: inspirationStatus('status').notNull().default('processing'),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type RawInspiration = typeof rawInspirations.$inferSelect
export type InsertRawInspiration = typeof rawInspirations.$inferInsert
