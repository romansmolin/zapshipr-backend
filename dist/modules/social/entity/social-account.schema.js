"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pinterestBoards = exports.socialAccounts = exports.pinterestBoardPrivacyEnum = exports.pinterestBoardPrivacyValues = exports.socialPlatformEnum = exports.socialPlatforms = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const user_schema_1 = require("@/modules/user/entity/user.schema");
const workspace_schema_1 = require("@/modules/workspace/entity/workspace.schema");
exports.socialPlatforms = [
    'facebook',
    'instagram',
    'threads',
    'pinterest',
    'tiktok',
    'youtube',
    'x',
    'linkedin',
    'bluesky',
];
exports.socialPlatformEnum = (0, pg_core_1.pgEnum)('social_platform', exports.socialPlatforms);
exports.pinterestBoardPrivacyValues = ['PUBLIC', 'PROTECTED', 'SECRET'];
exports.pinterestBoardPrivacyEnum = (0, pg_core_1.pgEnum)('pinterest_board_privacy', exports.pinterestBoardPrivacyValues);
exports.socialAccounts = (0, pg_core_1.pgTable)('social_accounts', {
    id: (0, pg_core_1.uuid)('id').primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => user_schema_1.users.id, { onDelete: 'cascade' }),
    workspaceId: (0, pg_core_1.uuid)('workspace_id').references(() => workspace_schema_1.workspaces.id, { onDelete: 'cascade' }),
    platform: (0, exports.socialPlatformEnum)('platform').notNull(),
    username: (0, pg_core_1.text)('username').notNull(),
    accessToken: (0, pg_core_1.text)('access_token').notNull(),
    refreshToken: (0, pg_core_1.text)('refresh_token'),
    picture: (0, pg_core_1.text)('picture'),
    connectedDate: (0, pg_core_1.timestamp)('connected_date', { withTimezone: false }),
    pageId: (0, pg_core_1.text)('page_id').notNull(),
    expiresIn: (0, pg_core_1.timestamp)('expires_in', { withTimezone: false }),
    refreshExpiresIn: (0, pg_core_1.timestamp)('refresh_expires_in', { withTimezone: false }),
    maxVideoPostDurationSec: (0, pg_core_1.integer)('max_video_post_duration_sec'),
    privacyLevelOptions: (0, pg_core_1.text)('privacy_level_options').array(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
}, (table) => ({
    userPageUnique: (0, pg_core_1.uniqueIndex)('social_accounts_user_page_unique').on(table.userId, table.pageId),
}));
exports.pinterestBoards = (0, pg_core_1.pgTable)('pinterest_boards', {
    id: (0, pg_core_1.uuid)('id').primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => user_schema_1.users.id, { onDelete: 'cascade' }),
    socialAccountId: (0, pg_core_1.uuid)('social_account_id')
        .notNull()
        .references(() => exports.socialAccounts.id, { onDelete: 'cascade' }),
    pinterestBoardId: (0, pg_core_1.text)('pinterest_board_id').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    ownerUsername: (0, pg_core_1.text)('owner_username'),
    thumbnailUrl: (0, pg_core_1.text)('thumbnail_url'),
    privacy: (0, exports.pinterestBoardPrivacyEnum)('privacy').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
}, (table) => ({
    userBoardUnique: (0, pg_core_1.uniqueIndex)('pinterest_boards_user_board_unique').on(table.userId, table.pinterestBoardId),
}));
