import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from '@/modules/user/entity/user.schema'

export const userMedia = pgTable(
    'user_media',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        key: varchar('key', { length: 1024 }).notNull().unique(),
        url: text('url').notNull(),
        size: integer('size').notNull(),
        contentType: varchar('content_type', { length: 128 }),
        lastModified: timestamp('last_modified', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        userIdIdx: index('user_media_user_id_idx').on(table.userId),
        keyIdx: index('user_media_key_idx').on(table.key),
    })
)

export type UserMedia = typeof userMedia.$inferSelect
export type InsertUserMedia = typeof userMedia.$inferInsert
