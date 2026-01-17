import { type AnyPgColumn, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const waitlistEntries = pgTable(
    'waitlist_entries',
    {
        id: uuid('id').primaryKey(),
        email: text('email').notNull(),
        emailNormalized: text('email_normalized').notNull(),
        status: text('status').notNull(),
        referralCode: text('referral_code').notNull(),
        referredById: uuid('referred_by_id').references((): AnyPgColumn => waitlistEntries.id, {
            onDelete: 'set null',
        }),
        referredAt: timestamp('referred_at', { withTimezone: false }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        emailNormalizedUnique: uniqueIndex('waitlist_entries_email_normalized_unique').on(table.emailNormalized),
        referralCodeUnique: uniqueIndex('waitlist_entries_referral_code_unique').on(table.referralCode),
    })
)

export type WaitlistEntryRow = typeof waitlistEntries.$inferSelect
export type NewWaitlistEntryRow = typeof waitlistEntries.$inferInsert
