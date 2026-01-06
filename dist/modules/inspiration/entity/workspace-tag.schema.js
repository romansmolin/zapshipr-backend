"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceTags = exports.tagCategory = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const workspace_schema_1 = require("@/modules/workspace/entity/workspace.schema");
exports.tagCategory = (0, pg_core_1.pgEnum)('tag_category', ['topic', 'format', 'tone', 'style', 'other']);
exports.workspaceTags = (0, pg_core_1.pgTable)('workspace_tags', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => workspace_schema_1.workspaces.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    category: (0, exports.tagCategory)('category').notNull(),
    // Метрики
    usageCount: (0, pg_core_1.integer)('usage_count').notNull().default(0),
    isUserCreated: (0, pg_core_1.boolean)('is_user_created').notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
