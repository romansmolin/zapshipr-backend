"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawInspirations = exports.inspirationStatus = exports.inspirationType = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const user_schema_1 = require("@/modules/user/entity/user.schema");
const workspace_schema_1 = require("@/modules/workspace/entity/workspace.schema");
exports.inspirationType = (0, pg_core_1.pgEnum)('inspiration_type', ['image', 'link', 'text', 'document']);
exports.inspirationStatus = (0, pg_core_1.pgEnum)('inspiration_status', ['processing', 'completed', 'failed']);
exports.rawInspirations = (0, pg_core_1.pgTable)('raw_inspirations', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .notNull()
        .references(() => workspace_schema_1.workspaces.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id')
        .notNull()
        .references(() => user_schema_1.users.id, { onDelete: 'cascade' }),
    type: (0, exports.inspirationType)('type').notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 100 }).notNull(),
    content: (0, pg_core_1.text)('content'),
    imageUrl: (0, pg_core_1.varchar)('image_url', { length: 1024 }),
    userDescription: (0, pg_core_1.text)('user_description'),
    metadata: (0, pg_core_1.jsonb)('metadata').$type(),
    parsedContent: (0, pg_core_1.text)('parsed_content'),
    status: (0, exports.inspirationStatus)('status').notNull().default('processing'),
    errorMessage: (0, pg_core_1.text)('error_message'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
