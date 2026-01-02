import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { users } from '@/modules/user/entity/user.schema'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'

export const socialPlatforms = [
    'facebook',
    'instagram',
    'threads',
    'pinterest',
    'tiktok',
    'youtube',
    'x',
    'linkedin',
    'bluesky',
] as const

export type SocialPlatform = (typeof socialPlatforms)[number]

export const socialPlatformEnum = pgEnum('social_platform', socialPlatforms)

export const pinterestBoardPrivacyValues = ['PUBLIC', 'PROTECTED', 'SECRET'] as const
export type PinterestBoardPrivacy = (typeof pinterestBoardPrivacyValues)[number]
export const pinterestBoardPrivacyEnum = pgEnum('pinterest_board_privacy', pinterestBoardPrivacyValues)

export const socialAccounts = pgTable(
    'social_accounts',
    {
        id: uuid('id').primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
        platform: socialPlatformEnum('platform').notNull(),
        username: text('username').notNull(),
        accessToken: text('access_token').notNull(),
        refreshToken: text('refresh_token'),
        picture: text('picture'),
        connectedDate: timestamp('connected_date', { withTimezone: false }),
        pageId: text('page_id').notNull(),
        expiresIn: timestamp('expires_in', { withTimezone: false }),
        refreshExpiresIn: timestamp('refresh_expires_in', { withTimezone: false }),
        maxVideoPostDurationSec: integer('max_video_post_duration_sec'),
        privacyLevelOptions: text('privacy_level_options').array(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        userPageUnique: uniqueIndex('social_accounts_user_page_unique').on(table.userId, table.pageId),
    })
)

export const pinterestBoards = pgTable(
    'pinterest_boards',
    {
        id: uuid('id').primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        socialAccountId: uuid('social_account_id')
            .notNull()
            .references(() => socialAccounts.id, { onDelete: 'cascade' }),
        pinterestBoardId: text('pinterest_board_id').notNull(),
        name: text('name').notNull(),
        description: text('description'),
        ownerUsername: text('owner_username'),
        thumbnailUrl: text('thumbnail_url'),
        privacy: pinterestBoardPrivacyEnum('privacy').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        userBoardUnique: uniqueIndex('pinterest_boards_user_board_unique').on(
            table.userId,
            table.pinterestBoardId
        ),
    })
)

export type SocialAccount = typeof socialAccounts.$inferSelect
export type NewSocialAccount = typeof socialAccounts.$inferInsert

export type PinterestBoard = typeof pinterestBoards.$inferSelect
export type NewPinterestBoard = typeof pinterestBoards.$inferInsert
