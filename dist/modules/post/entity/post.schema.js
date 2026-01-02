"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTargets = exports.postMediaAssets = exports.mediaAssets = exports.posts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const social_account_schema_1 = require("@/modules/social/entity/social-account.schema");
const user_schema_1 = require("@/modules/user/entity/user.schema");
const workspace_schema_1 = require("@/modules/workspace/entity/workspace.schema");
exports.posts = (0, pg_core_1.pgTable)('posts', {
    id: (0, pg_core_1.uuid)('id').primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => user_schema_1.users.id, { onDelete: 'cascade' }),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => workspace_schema_1.workspaces.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)('status').notNull(),
    type: (0, pg_core_1.text)('type'),
    scheduledTime: (0, pg_core_1.timestamp)('scheduled_time', { withTimezone: true }),
    mainCaption: (0, pg_core_1.text)('main_caption'),
    coverTimestamp: (0, pg_core_1.integer)('cover_timestamp'),
    coverImageUrl: (0, pg_core_1.text)('cover_image_url'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
});
exports.mediaAssets = (0, pg_core_1.pgTable)('media_assets', {
    id: (0, pg_core_1.uuid)('id').primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => user_schema_1.users.id, { onDelete: 'cascade' }),
    url: (0, pg_core_1.text)('url').notNull(),
    type: (0, pg_core_1.text)('type').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.postMediaAssets = (0, pg_core_1.pgTable)('post_media_assets', {
    postId: (0, pg_core_1.uuid)('post_id')
        .notNull()
        .references(() => exports.posts.id, { onDelete: 'cascade' }),
    mediaAssetId: (0, pg_core_1.uuid)('media_asset_id')
        .notNull()
        .references(() => exports.mediaAssets.id, { onDelete: 'cascade' }),
    order: (0, pg_core_1.integer)('order').notNull(),
}, (table) => ({
    pk: (0, pg_core_1.primaryKey)({ columns: [table.postId, table.mediaAssetId] }),
}));
exports.postTargets = (0, pg_core_1.pgTable)('post_targets', {
    postId: (0, pg_core_1.uuid)('post_id')
        .notNull()
        .references(() => exports.posts.id, { onDelete: 'cascade' }),
    socialAccountId: (0, pg_core_1.uuid)('social_account_id')
        .notNull()
        .references(() => social_account_schema_1.socialAccounts.id, { onDelete: 'cascade' }),
    platform: (0, social_account_schema_1.socialPlatformEnum)('platform').notNull(),
    status: (0, pg_core_1.text)('status').default('PENDING').notNull(),
    errorMessage: (0, pg_core_1.text)('error_message'),
    text: (0, pg_core_1.text)('text'),
    title: (0, pg_core_1.text)('title'),
    pinterestBoardId: (0, pg_core_1.text)('pinterest_board_id'),
    tags: (0, pg_core_1.text)('tags').array(),
    links: (0, pg_core_1.text)('links').array(),
    isAutoMusicEnabled: (0, pg_core_1.boolean)('is_auto_music_enabled'),
    instagramLocationId: (0, pg_core_1.text)('instagram_location_id'),
    instagramFacebookPageId: (0, pg_core_1.text)('instagram_facebook_page_id'),
    threadsReplies: (0, pg_core_1.jsonb)('threads_replies'),
    tikTokPostPrivacyLevel: (0, pg_core_1.text)('tik_tok_post_privacy_level'),
});
