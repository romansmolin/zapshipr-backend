import { pgTable, uuid, varchar, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'

// Enum для категорий тегов
export const tagCategory = pgEnum('tag_category', ['topic', 'format', 'tone', 'style', 'other'])

export const workspaceTags = pgTable('workspace_tags', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
        .notNull()
        .references(() => workspaces.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(), // Название тега
    category: tagCategory('category').notNull(), // Категория тега

    // Метрики
    usageCount: integer('usage_count').notNull().default(0), // Сколько раз встречался
    isUserCreated: boolean('is_user_created').notNull().default(false), // Создан пользователем

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type WorkspaceTag = typeof workspaceTags.$inferSelect
export type InsertWorkspaceTag = typeof workspaceTags.$inferInsert

