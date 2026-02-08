import { pgTable, uuid, varchar, jsonb, numeric, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { workspaces } from './workspace.schema'

export const workspaceProfileSignals = pgTable(
    'workspace_profile_signals',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        signalType: varchar('signal_type', { length: 50 }).notNull(),
        signalSource: varchar('signal_source', { length: 50 }).notNull(),
        signalData: jsonb('signal_data').notNull(),
        weight: numeric('weight', { precision: 3, scale: 2 }).default('1.0'),
        isProcessed: boolean('is_processed').default(false),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        workspaceIdx: index('workspace_signals_workspace_idx').on(table.workspaceId),
        typeIdx: index('workspace_signals_type_idx').on(table.signalType),
        processedIdx: index('workspace_signals_processed_idx').on(table.isProcessed),
        createdIdx: index('workspace_signals_created_idx').on(table.createdAt.desc()),
    })
)

export type WorkspaceProfileSignal = typeof workspaceProfileSignals.$inferSelect
export type InsertWorkspaceProfileSignal = typeof workspaceProfileSignals.$inferInsert
