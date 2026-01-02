import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { socialAccounts, socialPlatformEnum } from '@/modules/social/entity/social-account.schema'
import { users } from '@/modules/user/entity/user.schema'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'

export const posts = pgTable('posts', {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    type: text('type'),
    scheduledTime: timestamp('scheduled_time', { withTimezone: true }),
    mainCaption: text('main_caption'),
    coverTimestamp: integer('cover_timestamp'),
    coverImageUrl: text('cover_image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
})

export const mediaAssets = pgTable('media_assets', {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    type: text('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const postMediaAssets = pgTable(
    'post_media_assets',
    {
        postId: uuid('post_id')
            .notNull()
            .references(() => posts.id, { onDelete: 'cascade' }),
        mediaAssetId: uuid('media_asset_id')
            .notNull()
            .references(() => mediaAssets.id, { onDelete: 'cascade' }),
        order: integer('order').notNull(),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.postId, table.mediaAssetId] }),
    })
)

export const postTargets = pgTable('post_targets', {
    postId: uuid('post_id')
        .notNull()
        .references(() => posts.id, { onDelete: 'cascade' }),
    socialAccountId: uuid('social_account_id')
        .notNull()
        .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    platform: socialPlatformEnum('platform').notNull(),
    status: text('status').default('PENDING').notNull(),
    errorMessage: text('error_message'),
    text: text('text'),
    title: text('title'),
    pinterestBoardId: text('pinterest_board_id'),
    tags: text('tags').array(),
    links: text('links').array(),
    isAutoMusicEnabled: boolean('is_auto_music_enabled'),
    instagramLocationId: text('instagram_location_id'),
    instagramFacebookPageId: text('instagram_facebook_page_id'),
    threadsReplies: jsonb('threads_replies'),
    tikTokPostPrivacyLevel: text('tik_tok_post_privacy_level'),
})

export type PostRow = typeof posts.$inferSelect
export type NewPostRow = typeof posts.$inferInsert

export type MediaAssetRow = typeof mediaAssets.$inferSelect
export type NewMediaAssetRow = typeof mediaAssets.$inferInsert

export type PostMediaAssetRow = typeof postMediaAssets.$inferSelect
export type NewPostMediaAssetRow = typeof postMediaAssets.$inferInsert

export type PostTargetRow = typeof postTargets.$inferSelect
export type NewPostTargetRow = typeof postTargets.$inferInsert
