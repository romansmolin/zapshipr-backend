"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaces = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const user_schema_1 = require("@/modules/user/entity/user.schema");
exports.workspaces = (0, pg_core_1.pgTable)('workspaces', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => user_schema_1.users.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    avatarUrl: (0, pg_core_1.varchar)('avatar_url', { length: 1024 }),
    isDefault: (0, pg_core_1.boolean)('is_default').default(false).notNull(),
    mainPrompt: (0, pg_core_1.jsonb)('main_prompt'), // Структурированный main prompt для AI
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    userDefaultIdx: (0, pg_core_1.index)('workspaces_user_default_idx').on(table.userId, table.isDefault),
}));
