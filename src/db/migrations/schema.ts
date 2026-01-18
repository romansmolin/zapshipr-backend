import { pgTable, uuid, text, numeric, integer, unique, boolean, timestamp, foreignKey, varchar, date, index, serial, check, jsonb, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const pinterestBoardPrivacy = pgEnum("pinterest_board_privacy", ['PUBLIC', 'PROTECTED', 'SECRET'])
export const socialPlatform = pgEnum("social_platform", ['facebook', 'instagram', 'threads', 'pinterest', 'tiktok', 'youtube', 'x', 'linkedin', 'bluesky'])


export const tariffs = pgTable("tariffs", {
	id: uuid().primaryKey().notNull(),
	name: text().notNull(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	postLimit: integer("post_limit").notNull(),
	description: text(),
});

export const tenants = pgTable("tenants", {
	id: uuid().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	password: text(),
	googleAuth: boolean("google_auth").default(false).notNull(),
	avatar: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	refreshToken: text("refresh_token"),
	stripeCustomerId: text("stripe_customer_id"),
}, (table) => [
	unique("tenants_email_key").on(table.email),
	unique("tenants_stripe_customer_id_key").on(table.stripeCustomerId),
]);

export const socialAccounts = pgTable("social_accounts", {
	id: uuid().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	platform: text().notNull(),
	username: text().notNull(),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token"),
	picture: text(),
	connectedDate: timestamp("connected_date", { mode: 'string' }),
	pageId: text("page_id").notNull(),
	expiresIn: timestamp("expires_in", { mode: 'string' }),
	refreshExpiresIn: timestamp("refresh_expires_in", { mode: 'string' }),
	maxVideoPostDurationSec: integer("max_video_post_duration_sec"),
	privacyLevelOptions: text("privacy_level_options").array(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "social_accounts_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("social_accounts_tenant_page_unique").on(table.tenantId, table.pageId),
]);

export const userPlans = pgTable("user_plans", {
	id: uuid().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	planName: text("plan_name").notNull(),
	planType: text("plan_type").notNull(),
	sentPostsLimit: integer("sent_posts_limit").notNull(),
	scheduledPostsLimit: integer("scheduled_posts_limit").notNull(),
	platformsAllowed: text("platforms_allowed").array().notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	accountsLimit: numeric("accounts_limit").default('1'),
	stripeSubscriptionId: text("stripe_subscription_id"),
	stripePriceId: text("stripe_price_id"),
	status: text(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	stripeLookupKey: text("stripe_lookup_key"),
	aiRequestsLimit: integer("ai_requests_limit").default(0),
	billingStatus: text("billing_status").default('active').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "user_plans_tenant_id_fkey"
		}),
	unique("user_plans_stripe_subscription_id_key").on(table.stripeSubscriptionId),
]);

export const platformDailyUsage = pgTable("platform_daily_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	platform: varchar({ length: 50 }).notNull(),
	usageDate: date("usage_date").notNull(),
	scheduledCount: integer("scheduled_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("platform_daily_usage_user_id_platform_usage_date_key").on(table.userId, table.platform, table.usageDate),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	tokenId: uuid("token_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_password_reset_tokens_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "password_reset_tokens_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("password_reset_tokens_token_id_key").on(table.tokenId),
]);

export const migrations = pgTable("migrations", {
	id: serial().primaryKey().notNull(),
	filename: varchar({ length: 255 }).notNull(),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("migrations_filename_key").on(table.filename),
]);

export const mediaAssets = pgTable("media_assets", {
	id: uuid().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	url: text().notNull(),
	type: text().notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "media_assets_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const posts = pgTable("posts", {
	id: uuid().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	status: text().default('scheduled').notNull(),
	scheduledTime: timestamp("scheduled_time", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	mainCaption: text("main_caption"),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	coverTimestamp: numeric("cover_timestamp"),
	coverImageUrl: text("cover_image_url"),
	type: text().default('text').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "posts_tenant_id_fkey"
		}).onDelete("cascade"),
	check("posts_type_check", sql`type = ANY (ARRAY['text'::text, 'media'::text])`),
]);

export const magicLinks = pgTable("magic_links", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	tokenId: text("token_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	promoType: text("promo_type").default('STARTER_TRIAL').notNull(),
	promoDurationDays: integer("promo_duration_days").default(30).notNull(),
	maxUses: integer("max_uses").default(1).notNull(),
	redeemedCount: integer("redeemed_count").default(0).notNull(),
	redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: 'string' }),
	redeemedByUserId: uuid("redeemed_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("magic_links_token_id_idx").using("btree", table.tokenId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.redeemedByUserId],
			foreignColumns: [tenants.id],
			name: "magic_links_redeemed_by_user_id_fkey"
		}),
	unique("magic_links_token_id_key").on(table.tokenId),
	check("magic_links_max_uses_check", sql`max_uses > 0`),
	check("magic_links_redeemed_count_check", sql`redeemed_count >= 0`),
]);

export const waitlistEntries = pgTable("waitlist_entries", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	email: text().notNull(),
	emailNormalized: text("email_normalized").notNull(),
	status: text().default('ACTIVE').notNull(),
	referralCode: text("referral_code").notNull(),
	referredById: uuid("referred_by_id"),
	referredAt: timestamp("referred_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_waitlist_entries_referred_by_id").using("btree", table.referredById.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.referredById],
			foreignColumns: [table.id],
			name: "waitlist_entries_referred_by_id_fkey"
		}).onDelete("set null"),
	unique("waitlist_entries_email_normalized_key").on(table.emailNormalized),
	unique("waitlist_entries_referral_code_key").on(table.referralCode),
	check("waitlist_entries_status_check", sql`status = ANY (ARRAY['ACTIVE'::text, 'UNSUBSCRIBED'::text])`),
]);


export const pinterestBoards = pgTable("pinterest_boards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	socialAccountId: uuid("social_account_id").notNull(),
	pinterestBoardId: text("pinterest_board_id").notNull(),
	name: text().notNull(),
	description: text(),
	ownerUsername: text("owner_username"),
	thumbnailUrl: text("thumbnail_url"),
	privacy: text().default('PUBLIC').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "pinterest_boards_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.socialAccountId],
			foreignColumns: [socialAccounts.id],
			name: "pinterest_boards_social_account_id_fkey"
		}).onDelete("cascade"),
	unique("pinterest_boards_tenant_id_pinterest_board_id_key").on(table.tenantId, table.pinterestBoardId),
	unique("unique_pinterest_board_id").on(table.pinterestBoardId),
	check("pinterest_boards_privacy_check", sql`privacy = ANY (ARRAY['PUBLIC'::text, 'PROTECTED'::text, 'SECRET'::text])`),
]);


export const tiktokPublishJobs = pgTable("tiktok_publish_jobs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	creatorId: text("creator_id").notNull(),
	socialAccountId: uuid("social_account_id"),
	postType: text("post_type").notNull(),
	mediaUrls: text("media_urls").array().notNull(),
	title: text().notNull(),
	privacyLevel: text("privacy_level").notNull(),
	allowComment: boolean("allow_comment").notNull(),
	allowDuet: boolean("allow_duet").notNull(),
	allowStitch: boolean("allow_stitch").notNull(),
	commercialEnabled: boolean("commercial_enabled").default(false).notNull(),
	commercialYourBrand: boolean("commercial_your_brand").default(false).notNull(),
	commercialBrandedContent: boolean("commercial_branded_content").default(false).notNull(),
	videoDurationSec: integer("video_duration_sec"),
	tiktokPublishId: text("tiktok_publish_id"),
	tiktokPostId: text("tiktok_post_id"),
	status: text().notNull(),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	lastStatusFetchedAt: timestamp("last_status_fetched_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tiktok_publish_jobs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_tiktok_publish_jobs_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_tiktok_publish_jobs_tiktok_publish_id").using("btree", table.tiktokPublishId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tiktok_publish_jobs_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.socialAccountId],
			foreignColumns: [socialAccounts.id],
			name: "tiktok_publish_jobs_social_account_id_fkey"
		}).onDelete("set null"),
	check("tiktok_publish_jobs_post_type_check", sql`post_type = ANY (ARRAY['VIDEO'::text, 'PHOTO'::text])`),
	check("tiktok_publish_jobs_status_check", sql`status = ANY (ARRAY['QUEUED'::text, 'UPLOADING'::text, 'PROCESSING'::text, 'PUBLISHED'::text, 'FAILED'::text, 'CANCELLED'::text])`),
]);

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash"),
	googleAuth: boolean("google_auth").default(false).notNull(),
	avatar: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	refreshToken: text("refresh_token"),
	stripeCustomerId: text("stripe_customer_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const userPlanUsage = pgTable("user_plan_usage", {
	id: uuid().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	planId: uuid("plan_id").notNull(),
	usageType: text("usage_type").notNull(),
	periodStart: timestamp("period_start", { mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { mode: 'string' }).notNull(),
	usedCount: integer("used_count").default(0),
	limitCount: integer("limit_count").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "user_plan_usage_tenant_id_fkey"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [userPlans.id],
			name: "user_plan_usage_plan_id_fkey"
		}),
	check("user_plan_usage_usage_type_check", sql`usage_type = ANY (ARRAY['sent'::text, 'scheduled'::text, 'accounts'::text, 'ai'::text])`),
]);

export const tenantSettings = pgTable("tenant_settings", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	timezone: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tenant_settings_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_settings_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("tenant_settings_tenant_id_key").on(table.tenantId),
	check("tenant_settings_timezone_not_blank", sql`btrim(timezone) <> ''::text`),
]);

export const postMediaAssets = pgTable("post_media_assets", {
	postId: uuid("post_id").notNull(),
	mediaAssetId: uuid("media_asset_id").notNull(),
	order: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "post_media_assets_post_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.mediaAssetId],
			foreignColumns: [mediaAssets.id],
			name: "post_media_assets_media_asset_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.postId, table.mediaAssetId], name: "post_media_assets_pkey"}),
]);

export const postTargets = pgTable("post_targets", {
	postId: uuid("post_id").notNull(),
	socialAccountId: uuid("social_account_id").notNull(),
	platform: text().notNull(),
	status: text().default('PENDING').notNull(),
	errorMessage: text("error_message"),
	text: text(),
	title: text(),
	pinterestBoardId: text("pinterest_board_id"),
	tags: text().array().default([""]),
	links: text().array().default([""]),
	isAutoMusicEnabled: boolean("is_auto_music_enabled").default(false),
	instagramLocationId: text("instagram_location_id"),
	instagramAudioName: text("instagram_audio_name"),
	instagramFacebookPageId: text("instagram_facebook_page_id"),
	threadsReplies: jsonb("threads_replies").default([]).notNull(),
	tikTokPostPrivacyLevel: text("tik_tok_post_privacy_level"),
}, (table) => [
	index("idx_post_targets_links").using("gin", table.links.asc().nullsLast().op("array_ops")),
	index("idx_post_targets_tags").using("gin", table.tags.asc().nullsLast().op("array_ops")),
	foreignKey({
			columns: [table.socialAccountId],
			foreignColumns: [socialAccounts.id],
			name: "post_targets_social_account_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.postId, table.socialAccountId], name: "post_targets_pkey"}),
	check("post_targets_tik_tok_post_privacy_level_check", sql`tik_tok_post_privacy_level = ANY (ARRAY['SELF_ONLY'::text, 'PUBLIC_TO_EVERYONE'::text, 'MUTUAL_FOLLOW_FRIENDS'::text, 'FOLLOWER_OF_CREATOR'::text])`),
]);
