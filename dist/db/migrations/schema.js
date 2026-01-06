"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTargets = exports.postMediaAssets = exports.tenantSettings = exports.userPlanUsage = exports.users = exports.tiktokPublishJobs = exports.waitlistReferralEvents = exports.pinterestBoards = exports.waitlistReferralRewards = exports.waitlistEntries = exports.magicLinks = exports.posts = exports.mediaAssets = exports.migrations = exports.passwordResetTokens = exports.platformDailyUsage = exports.userPlans = exports.socialAccounts = exports.tenants = exports.tariffs = exports.socialPlatform = exports.pinterestBoardPrivacy = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.pinterestBoardPrivacy = (0, pg_core_1.pgEnum)("pinterest_board_privacy", ['PUBLIC', 'PROTECTED', 'SECRET']);
exports.socialPlatform = (0, pg_core_1.pgEnum)("social_platform", ['facebook', 'instagram', 'threads', 'pinterest', 'tiktok', 'youtube', 'x', 'linkedin', 'bluesky']);
exports.tariffs = (0, pg_core_1.pgTable)("tariffs", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    price: (0, pg_core_1.numeric)({ precision: 10, scale: 2 }).notNull(),
    postLimit: (0, pg_core_1.integer)("post_limit").notNull(),
    description: (0, pg_core_1.text)(),
});
exports.tenants = (0, pg_core_1.pgTable)("tenants", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    email: (0, pg_core_1.text)().notNull(),
    password: (0, pg_core_1.text)(),
    googleAuth: (0, pg_core_1.boolean)("google_auth").default(false).notNull(),
    avatar: (0, pg_core_1.text)(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    stripeCustomerId: (0, pg_core_1.text)("stripe_customer_id"),
}, (table) => [
    (0, pg_core_1.unique)("tenants_email_key").on(table.email),
    (0, pg_core_1.unique)("tenants_stripe_customer_id_key").on(table.stripeCustomerId),
]);
exports.socialAccounts = (0, pg_core_1.pgTable)("social_accounts", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    platform: (0, pg_core_1.text)().notNull(),
    username: (0, pg_core_1.text)().notNull(),
    accessToken: (0, pg_core_1.text)("access_token").notNull(),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    picture: (0, pg_core_1.text)(),
    connectedDate: (0, pg_core_1.timestamp)("connected_date", { mode: 'string' }),
    pageId: (0, pg_core_1.text)("page_id").notNull(),
    expiresIn: (0, pg_core_1.timestamp)("expires_in", { mode: 'string' }),
    refreshExpiresIn: (0, pg_core_1.timestamp)("refresh_expires_in", { mode: 'string' }),
    maxVideoPostDurationSec: (0, pg_core_1.integer)("max_video_post_duration_sec"),
    privacyLevelOptions: (0, pg_core_1.text)("privacy_level_options").array(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "social_accounts_tenant_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("social_accounts_tenant_page_unique").on(table.tenantId, table.pageId),
]);
exports.userPlans = (0, pg_core_1.pgTable)("user_plans", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    planName: (0, pg_core_1.text)("plan_name").notNull(),
    planType: (0, pg_core_1.text)("plan_type").notNull(),
    sentPostsLimit: (0, pg_core_1.integer)("sent_posts_limit").notNull(),
    scheduledPostsLimit: (0, pg_core_1.integer)("scheduled_posts_limit").notNull(),
    platformsAllowed: (0, pg_core_1.text)("platforms_allowed").array().notNull(),
    startDate: (0, pg_core_1.timestamp)("start_date", { mode: 'string' }).notNull(),
    endDate: (0, pg_core_1.timestamp)("end_date", { mode: 'string' }),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
    accountsLimit: (0, pg_core_1.numeric)("accounts_limit").default('1'),
    stripeSubscriptionId: (0, pg_core_1.text)("stripe_subscription_id"),
    stripePriceId: (0, pg_core_1.text)("stripe_price_id"),
    status: (0, pg_core_1.text)(),
    currentPeriodEnd: (0, pg_core_1.timestamp)("current_period_end", { withTimezone: true, mode: 'string' }),
    stripeLookupKey: (0, pg_core_1.text)("stripe_lookup_key"),
    aiRequestsLimit: (0, pg_core_1.integer)("ai_requests_limit").default(0),
    billingStatus: (0, pg_core_1.text)("billing_status").default('active').notNull(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "user_plans_tenant_id_fkey"
    }),
    (0, pg_core_1.unique)("user_plans_stripe_subscription_id_key").on(table.stripeSubscriptionId),
]);
exports.platformDailyUsage = (0, pg_core_1.pgTable)("platform_daily_usage", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    userId: (0, pg_core_1.uuid)("user_id").notNull(),
    platform: (0, pg_core_1.varchar)({ length: 50 }).notNull(),
    usageDate: (0, pg_core_1.date)("usage_date").notNull(),
    scheduledCount: (0, pg_core_1.integer)("scheduled_count").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.unique)("platform_daily_usage_user_id_platform_usage_date_key").on(table.userId, table.platform, table.usageDate),
]);
exports.passwordResetTokens = (0, pg_core_1.pgTable)("password_reset_tokens", {
    id: (0, pg_core_1.uuid)().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`).primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    tokenId: (0, pg_core_1.uuid)("token_id").notNull(),
    tokenHash: (0, pg_core_1.text)("token_hash").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
    usedAt: (0, pg_core_1.timestamp)("used_at", { withTimezone: true, mode: 'string' }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.index)("idx_password_reset_tokens_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "password_reset_tokens_tenant_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("password_reset_tokens_token_id_key").on(table.tokenId),
]);
exports.migrations = (0, pg_core_1.pgTable)("migrations", {
    id: (0, pg_core_1.serial)().primaryKey().notNull(),
    filename: (0, pg_core_1.varchar)({ length: 255 }).notNull(),
    executedAt: (0, pg_core_1.timestamp)("executed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.unique)("migrations_filename_key").on(table.filename),
]);
exports.mediaAssets = (0, pg_core_1.pgTable)("media_assets", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    url: (0, pg_core_1.text)().notNull(),
    type: (0, pg_core_1.text)().notNull(),
    uploadedAt: (0, pg_core_1.timestamp)("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "media_assets_tenant_id_fkey"
    }).onDelete("cascade"),
]);
exports.posts = (0, pg_core_1.pgTable)("posts", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    status: (0, pg_core_1.text)().default('scheduled').notNull(),
    scheduledTime: (0, pg_core_1.timestamp)("scheduled_time", { mode: 'string' }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow().notNull(),
    mainCaption: (0, pg_core_1.text)("main_caption"),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }),
    coverTimestamp: (0, pg_core_1.numeric)("cover_timestamp"),
    coverImageUrl: (0, pg_core_1.text)("cover_image_url"),
    type: (0, pg_core_1.text)().default('text').notNull(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "posts_tenant_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.check)("posts_type_check", (0, drizzle_orm_1.sql) `type = ANY (ARRAY['text'::text, 'media'::text])`),
]);
exports.magicLinks = (0, pg_core_1.pgTable)("magic_links", {
    id: (0, pg_core_1.uuid)().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`).primaryKey().notNull(),
    tokenId: (0, pg_core_1.text)("token_id").notNull(),
    tokenHash: (0, pg_core_1.text)("token_hash").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
    promoType: (0, pg_core_1.text)("promo_type").default('STARTER_TRIAL').notNull(),
    promoDurationDays: (0, pg_core_1.integer)("promo_duration_days").default(30).notNull(),
    maxUses: (0, pg_core_1.integer)("max_uses").default(1).notNull(),
    redeemedCount: (0, pg_core_1.integer)("redeemed_count").default(0).notNull(),
    redeemedAt: (0, pg_core_1.timestamp)("redeemed_at", { withTimezone: true, mode: 'string' }),
    redeemedByUserId: (0, pg_core_1.uuid)("redeemed_by_user_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("magic_links_token_id_idx").using("btree", table.tokenId.asc().nullsLast().op("text_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.redeemedByUserId],
        foreignColumns: [exports.tenants.id],
        name: "magic_links_redeemed_by_user_id_fkey"
    }),
    (0, pg_core_1.unique)("magic_links_token_id_key").on(table.tokenId),
    (0, pg_core_1.check)("magic_links_max_uses_check", (0, drizzle_orm_1.sql) `max_uses > 0`),
    (0, pg_core_1.check)("magic_links_redeemed_count_check", (0, drizzle_orm_1.sql) `redeemed_count >= 0`),
]);
exports.waitlistEntries = (0, pg_core_1.pgTable)("waitlist_entries", {
    id: (0, pg_core_1.uuid)().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`).primaryKey().notNull(),
    email: (0, pg_core_1.text)().notNull(),
    emailNormalized: (0, pg_core_1.text)("email_normalized").notNull(),
    status: (0, pg_core_1.text)().default('ACTIVE').notNull(),
    referralCode: (0, pg_core_1.text)("referral_code").notNull(),
    referredById: (0, pg_core_1.uuid)("referred_by_id"),
    referredAt: (0, pg_core_1.timestamp)("referred_at", { withTimezone: true, mode: 'string' }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_waitlist_entries_referred_by_id").using("btree", table.referredById.asc().nullsLast().op("uuid_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.referredById],
        foreignColumns: [table.id],
        name: "waitlist_entries_referred_by_id_fkey"
    }).onDelete("set null"),
    (0, pg_core_1.unique)("waitlist_entries_email_normalized_key").on(table.emailNormalized),
    (0, pg_core_1.unique)("waitlist_entries_referral_code_key").on(table.referralCode),
    (0, pg_core_1.check)("waitlist_entries_status_check", (0, drizzle_orm_1.sql) `status = ANY (ARRAY['ACTIVE'::text, 'UNSUBSCRIBED'::text])`),
]);
exports.waitlistReferralRewards = (0, pg_core_1.pgTable)("waitlist_referral_rewards", {
    id: (0, pg_core_1.uuid)().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`).primaryKey().notNull(),
    waitlistEntryId: (0, pg_core_1.uuid)("waitlist_entry_id").notNull(),
    type: (0, pg_core_1.text)().notNull(),
    status: (0, pg_core_1.text)().notNull(),
    grantedAt: (0, pg_core_1.timestamp)("granted_at", { withTimezone: true, mode: 'string' }),
    meta: (0, pg_core_1.jsonb)(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_waitlist_referral_rewards_entry_id").using("btree", table.waitlistEntryId.asc().nullsLast().op("uuid_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.waitlistEntryId],
        foreignColumns: [exports.waitlistEntries.id],
        name: "waitlist_referral_rewards_waitlist_entry_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("waitlist_referral_rewards_unique").on(table.waitlistEntryId, table.type),
    (0, pg_core_1.check)("waitlist_referral_rewards_type_check", (0, drizzle_orm_1.sql) `type = 'SIX_MONTHS_FREE'::text`),
    (0, pg_core_1.check)("waitlist_referral_rewards_status_check", (0, drizzle_orm_1.sql) `status = ANY (ARRAY['PENDING'::text, 'GRANTED'::text, 'REDEEMED'::text])`),
]);
exports.pinterestBoards = (0, pg_core_1.pgTable)("pinterest_boards", {
    id: (0, pg_core_1.uuid)().defaultRandom().primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    socialAccountId: (0, pg_core_1.uuid)("social_account_id").notNull(),
    pinterestBoardId: (0, pg_core_1.text)("pinterest_board_id").notNull(),
    name: (0, pg_core_1.text)().notNull(),
    description: (0, pg_core_1.text)(),
    ownerUsername: (0, pg_core_1.text)("owner_username"),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    privacy: (0, pg_core_1.text)().default('PUBLIC').notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "pinterest_boards_tenant_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.foreignKey)({
        columns: [table.socialAccountId],
        foreignColumns: [exports.socialAccounts.id],
        name: "pinterest_boards_social_account_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("pinterest_boards_tenant_id_pinterest_board_id_key").on(table.tenantId, table.pinterestBoardId),
    (0, pg_core_1.unique)("unique_pinterest_board_id").on(table.pinterestBoardId),
    (0, pg_core_1.check)("pinterest_boards_privacy_check", (0, drizzle_orm_1.sql) `privacy = ANY (ARRAY['PUBLIC'::text, 'PROTECTED'::text, 'SECRET'::text])`),
]);
exports.waitlistReferralEvents = (0, pg_core_1.pgTable)("waitlist_referral_events", {
    id: (0, pg_core_1.uuid)().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`).primaryKey().notNull(),
    referrerId: (0, pg_core_1.uuid)("referrer_id").notNull(),
    referredEntryId: (0, pg_core_1.uuid)("referred_entry_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_waitlist_referral_events_referrer_id").using("btree", table.referrerId.asc().nullsLast().op("uuid_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.referrerId],
        foreignColumns: [exports.waitlistEntries.id],
        name: "waitlist_referral_events_referrer_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.foreignKey)({
        columns: [table.referredEntryId],
        foreignColumns: [exports.waitlistEntries.id],
        name: "waitlist_referral_events_referred_entry_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("waitlist_referral_events_referred_entry_key").on(table.referredEntryId),
]);
exports.tiktokPublishJobs = (0, pg_core_1.pgTable)("tiktok_publish_jobs", {
    id: (0, pg_core_1.uuid)().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`).primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    creatorId: (0, pg_core_1.text)("creator_id").notNull(),
    socialAccountId: (0, pg_core_1.uuid)("social_account_id"),
    postType: (0, pg_core_1.text)("post_type").notNull(),
    mediaUrls: (0, pg_core_1.text)("media_urls").array().notNull(),
    title: (0, pg_core_1.text)().notNull(),
    privacyLevel: (0, pg_core_1.text)("privacy_level").notNull(),
    allowComment: (0, pg_core_1.boolean)("allow_comment").notNull(),
    allowDuet: (0, pg_core_1.boolean)("allow_duet").notNull(),
    allowStitch: (0, pg_core_1.boolean)("allow_stitch").notNull(),
    commercialEnabled: (0, pg_core_1.boolean)("commercial_enabled").default(false).notNull(),
    commercialYourBrand: (0, pg_core_1.boolean)("commercial_your_brand").default(false).notNull(),
    commercialBrandedContent: (0, pg_core_1.boolean)("commercial_branded_content").default(false).notNull(),
    videoDurationSec: (0, pg_core_1.integer)("video_duration_sec"),
    tiktokPublishId: (0, pg_core_1.text)("tiktok_publish_id"),
    tiktokPostId: (0, pg_core_1.text)("tiktok_post_id"),
    status: (0, pg_core_1.text)().notNull(),
    errorCode: (0, pg_core_1.text)("error_code"),
    errorMessage: (0, pg_core_1.text)("error_message"),
    lastStatusFetchedAt: (0, pg_core_1.timestamp)("last_status_fetched_at", { withTimezone: true, mode: 'string' }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_tiktok_publish_jobs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
    (0, pg_core_1.index)("idx_tiktok_publish_jobs_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
    (0, pg_core_1.index)("idx_tiktok_publish_jobs_tiktok_publish_id").using("btree", table.tiktokPublishId.asc().nullsLast().op("text_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "tiktok_publish_jobs_tenant_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.foreignKey)({
        columns: [table.socialAccountId],
        foreignColumns: [exports.socialAccounts.id],
        name: "tiktok_publish_jobs_social_account_id_fkey"
    }).onDelete("set null"),
    (0, pg_core_1.check)("tiktok_publish_jobs_post_type_check", (0, drizzle_orm_1.sql) `post_type = ANY (ARRAY['VIDEO'::text, 'PHOTO'::text])`),
    (0, pg_core_1.check)("tiktok_publish_jobs_status_check", (0, drizzle_orm_1.sql) `status = ANY (ARRAY['QUEUED'::text, 'UPLOADING'::text, 'PROCESSING'::text, 'PUBLISHED'::text, 'FAILED'::text, 'CANCELLED'::text])`),
]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    name: (0, pg_core_1.text)().notNull(),
    email: (0, pg_core_1.text)().notNull(),
    passwordHash: (0, pg_core_1.text)("password_hash"),
    googleAuth: (0, pg_core_1.boolean)("google_auth").default(false).notNull(),
    avatar: (0, pg_core_1.text)(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    stripeCustomerId: (0, pg_core_1.text)("stripe_customer_id"),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.unique)("users_email_unique").on(table.email),
]);
exports.userPlanUsage = (0, pg_core_1.pgTable)("user_plan_usage", {
    id: (0, pg_core_1.uuid)().primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    planId: (0, pg_core_1.uuid)("plan_id").notNull(),
    usageType: (0, pg_core_1.text)("usage_type").notNull(),
    periodStart: (0, pg_core_1.timestamp)("period_start", { mode: 'string' }).notNull(),
    periodEnd: (0, pg_core_1.timestamp)("period_end", { mode: 'string' }).notNull(),
    usedCount: (0, pg_core_1.integer)("used_count").default(0),
    limitCount: (0, pg_core_1.integer)("limit_count").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: 'string' }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "user_plan_usage_tenant_id_fkey"
    }),
    (0, pg_core_1.foreignKey)({
        columns: [table.planId],
        foreignColumns: [exports.userPlans.id],
        name: "user_plan_usage_plan_id_fkey"
    }),
    (0, pg_core_1.check)("user_plan_usage_usage_type_check", (0, drizzle_orm_1.sql) `usage_type = ANY (ARRAY['sent'::text, 'scheduled'::text, 'accounts'::text, 'ai'::text])`),
]);
exports.tenantSettings = (0, pg_core_1.pgTable)("tenant_settings", {
    id: (0, pg_core_1.uuid)().default((0, drizzle_orm_1.sql) `uuid_generate_v4()`).primaryKey().notNull(),
    tenantId: (0, pg_core_1.uuid)("tenant_id").notNull(),
    timezone: (0, pg_core_1.text)().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_tenant_settings_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.tenantId],
        foreignColumns: [exports.tenants.id],
        name: "tenant_settings_tenant_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.unique)("tenant_settings_tenant_id_key").on(table.tenantId),
    (0, pg_core_1.check)("tenant_settings_timezone_not_blank", (0, drizzle_orm_1.sql) `btrim(timezone) <> ''::text`),
]);
exports.postMediaAssets = (0, pg_core_1.pgTable)("post_media_assets", {
    postId: (0, pg_core_1.uuid)("post_id").notNull(),
    mediaAssetId: (0, pg_core_1.uuid)("media_asset_id").notNull(),
    order: (0, pg_core_1.integer)().notNull(),
}, (table) => [
    (0, pg_core_1.foreignKey)({
        columns: [table.postId],
        foreignColumns: [exports.posts.id],
        name: "post_media_assets_post_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.foreignKey)({
        columns: [table.mediaAssetId],
        foreignColumns: [exports.mediaAssets.id],
        name: "post_media_assets_media_asset_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.primaryKey)({ columns: [table.postId, table.mediaAssetId], name: "post_media_assets_pkey" }),
]);
exports.postTargets = (0, pg_core_1.pgTable)("post_targets", {
    postId: (0, pg_core_1.uuid)("post_id").notNull(),
    socialAccountId: (0, pg_core_1.uuid)("social_account_id").notNull(),
    platform: (0, pg_core_1.text)().notNull(),
    status: (0, pg_core_1.text)().default('PENDING').notNull(),
    errorMessage: (0, pg_core_1.text)("error_message"),
    text: (0, pg_core_1.text)(),
    title: (0, pg_core_1.text)(),
    pinterestBoardId: (0, pg_core_1.text)("pinterest_board_id"),
    tags: (0, pg_core_1.text)().array().default([""]),
    links: (0, pg_core_1.text)().array().default([""]),
    isAutoMusicEnabled: (0, pg_core_1.boolean)("is_auto_music_enabled").default(false),
    instagramLocationId: (0, pg_core_1.text)("instagram_location_id"),
    instagramAudioName: (0, pg_core_1.text)("instagram_audio_name"),
    instagramFacebookPageId: (0, pg_core_1.text)("instagram_facebook_page_id"),
    threadsReplies: (0, pg_core_1.jsonb)("threads_replies").default([]).notNull(),
    tikTokPostPrivacyLevel: (0, pg_core_1.text)("tik_tok_post_privacy_level"),
}, (table) => [
    (0, pg_core_1.index)("idx_post_targets_links").using("gin", table.links.asc().nullsLast().op("array_ops")),
    (0, pg_core_1.index)("idx_post_targets_tags").using("gin", table.tags.asc().nullsLast().op("array_ops")),
    (0, pg_core_1.foreignKey)({
        columns: [table.socialAccountId],
        foreignColumns: [exports.socialAccounts.id],
        name: "post_targets_social_account_id_fkey"
    }).onDelete("cascade"),
    (0, pg_core_1.primaryKey)({ columns: [table.postId, table.socialAccountId], name: "post_targets_pkey" }),
    (0, pg_core_1.check)("post_targets_tik_tok_post_privacy_level_check", (0, drizzle_orm_1.sql) `tik_tok_post_privacy_level = ANY (ARRAY['SELF_ONLY'::text, 'PUBLIC_TO_EVERYONE'::text, 'MUTUAL_FOLLOW_FRIENDS'::text, 'FOLLOWER_OF_CREATOR'::text])`),
]);
