import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { users } from '@/modules/user/entity/user.schema'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'

// Enum для типов вдохновений
export const inspirationType = pgEnum('inspiration_type', ['image', 'link', 'text', 'document'])

// Enum для статуса обработки
export const inspirationStatus = pgEnum('inspiration_status', ['processing', 'completed', 'failed'])

export const rawInspirations = pgTable('raw_inspirations', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    // Тип вдохновения
    type: inspirationType('type').notNull(),

    // Данные вдохновения
    content: text('content'), // URL или текст
    imageUrl: varchar('image_url', { length: 1024 }), // Ссылка на изображение в S3
    userDescription: text('user_description'), // Описание от пользователя

    // Метаданные (parsed)
    metadata: jsonb('metadata'), // {title, description, author, domain, etc}
    parsedContent: text('parsed_content'), // Извлеченный текст (max 1500 слов)

    // Статус обработки
    status: inspirationStatus('status').notNull().default('processing'),
    errorMessage: text('error_message'), // Если status=failed

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type RawInspiration = typeof rawInspirations.$inferSelect
export type InsertRawInspiration = typeof rawInspirations.$inferInsert

