import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    googleAuth: boolean('google_auth').default(false).notNull(),
    avatar: text('avatar'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    refreshToken: text('refresh_token'),
    stripeCustomerId: text('stripe_customer_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
