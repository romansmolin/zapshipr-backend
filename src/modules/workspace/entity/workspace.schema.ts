import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core'
import { users } from '@/modules/user/entity/user.schema'

export const workspaces = pgTable('workspaces', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    avatarUrl: varchar('avatar_url', { length: 1024 }),
    isDefault: boolean('is_default').default(false).notNull(),
    mainPrompt: jsonb('main_prompt'), // Структурированный main prompt для AI
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userDefaultIdx: index('workspaces_user_default_idx').on(table.userId, table.isDefault),
}))

export type Workspace = typeof workspaces.$inferSelect
export type InsertWorkspace = typeof workspaces.$inferInsert
