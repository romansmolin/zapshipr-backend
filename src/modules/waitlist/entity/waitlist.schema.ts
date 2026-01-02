import { type AnyPgColumn, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
        emailNormalizedUnique: uniqueIndex('waitlist_entries_email_normalized_unique').on(
            table.emailNormalized
        ),
        referralCodeUnique: uniqueIndex('waitlist_entries_referral_code_unique').on(table.referralCode),
    })
)

export const waitlistReferralEvents = pgTable(
    'waitlist_referral_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        referrerId: uuid('referrer_id')
            .notNull()
            .references(() => waitlistEntries.id, { onDelete: 'cascade' }),
        referredEntryId: uuid('referred_entry_id')
            .notNull()
            .references(() => waitlistEntries.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        referredEntryUnique: uniqueIndex('waitlist_referral_events_referred_entry_unique').on(
            table.referredEntryId
        ),
    })
)

export const waitlistReferralRewards = pgTable(
    'waitlist_referral_rewards',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        waitlistEntryId: uuid('waitlist_entry_id')
            .notNull()
            .references(() => waitlistEntries.id, { onDelete: 'cascade' }),
        type: text('type').notNull(),
        status: text('status').notNull(),
        grantedAt: timestamp('granted_at', { withTimezone: true }),
        meta: jsonb('meta'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        entryTypeUnique: uniqueIndex('waitlist_referral_rewards_entry_type_unique').on(
            table.waitlistEntryId,
            table.type
        ),
    })
)

export type WaitlistEntryRow = typeof waitlistEntries.$inferSelect
export type NewWaitlistEntryRow = typeof waitlistEntries.$inferInsert

export type WaitlistReferralRewardRow = typeof waitlistReferralRewards.$inferSelect
export type NewWaitlistReferralRewardRow = typeof waitlistReferralRewards.$inferInsert
