"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitlistReferralRewards = exports.waitlistReferralEvents = exports.waitlistEntries = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.waitlistEntries = (0, pg_core_1.pgTable)('waitlist_entries', {
    id: (0, pg_core_1.uuid)('id').primaryKey(),
    email: (0, pg_core_1.text)('email').notNull(),
    emailNormalized: (0, pg_core_1.text)('email_normalized').notNull(),
    status: (0, pg_core_1.text)('status').notNull(),
    referralCode: (0, pg_core_1.text)('referral_code').notNull(),
    referredById: (0, pg_core_1.uuid)('referred_by_id').references(() => exports.waitlistEntries.id, {
        onDelete: 'set null',
    }),
    referredAt: (0, pg_core_1.timestamp)('referred_at', { withTimezone: false }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
}, (table) => ({
    emailNormalizedUnique: (0, pg_core_1.uniqueIndex)('waitlist_entries_email_normalized_unique').on(table.emailNormalized),
    referralCodeUnique: (0, pg_core_1.uniqueIndex)('waitlist_entries_referral_code_unique').on(table.referralCode),
}));
exports.waitlistReferralEvents = (0, pg_core_1.pgTable)('waitlist_referral_events', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    referrerId: (0, pg_core_1.uuid)('referrer_id')
        .notNull()
        .references(() => exports.waitlistEntries.id, { onDelete: 'cascade' }),
    referredEntryId: (0, pg_core_1.uuid)('referred_entry_id')
        .notNull()
        .references(() => exports.waitlistEntries.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    referredEntryUnique: (0, pg_core_1.uniqueIndex)('waitlist_referral_events_referred_entry_unique').on(table.referredEntryId),
}));
exports.waitlistReferralRewards = (0, pg_core_1.pgTable)('waitlist_referral_rewards', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    waitlistEntryId: (0, pg_core_1.uuid)('waitlist_entry_id')
        .notNull()
        .references(() => exports.waitlistEntries.id, { onDelete: 'cascade' }),
    type: (0, pg_core_1.text)('type').notNull(),
    status: (0, pg_core_1.text)('status').notNull(),
    grantedAt: (0, pg_core_1.timestamp)('granted_at', { withTimezone: true }),
    meta: (0, pg_core_1.jsonb)('meta'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
}, (table) => ({
    entryTypeUnique: (0, pg_core_1.uniqueIndex)('waitlist_referral_rewards_entry_type_unique').on(table.waitlistEntryId, table.type),
}));
