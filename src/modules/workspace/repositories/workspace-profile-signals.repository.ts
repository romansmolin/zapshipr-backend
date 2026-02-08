import { eq, and, sql, desc, gte } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type { DBSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger'

import type {
    InsertWorkspaceProfileSignal,
    WorkspaceProfileSignal,
} from '../entity/workspace-profile-signal.schema'
import { workspaceProfileSignals } from '../entity/workspace-profile-signal.schema'
import type { IWorkspaceProfileSignalsRepository } from './workspace-profile-signals-repository.interface'
import type { AggregateOptions, AggregateResult } from '../entity/workspace-profile.types'

export class WorkspaceProfileSignalsRepository implements IWorkspaceProfileSignalsRepository {
    constructor(
        private db: NodePgDatabase<DBSchema>,
        private logger: ILogger
    ) {}

    async create(data: InsertWorkspaceProfileSignal): Promise<WorkspaceProfileSignal> {
        this.logger.info('Creating workspace profile signal', {
            workspaceId: data.workspaceId,
            signalType: data.signalType,
        })

        const [signal] = await this.db
            .insert(workspaceProfileSignals)
            .values(data)
            .returning()

        this.logger.info('Workspace profile signal created', { id: signal.id })

        return signal
    }

    async findRecent(
        workspaceId: string,
        options: {
            daysBack: number
            limit: number
            signalType?: string
        }
    ): Promise<WorkspaceProfileSignal[]> {
        this.logger.info('Finding recent workspace signals', { workspaceId, ...options })

        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - options.daysBack)

        const conditions = [
            eq(workspaceProfileSignals.workspaceId, workspaceId),
            gte(workspaceProfileSignals.createdAt, cutoffDate),
        ]

        if (options.signalType) {
            conditions.push(eq(workspaceProfileSignals.signalType, options.signalType))
        }

        const signals = await this.db
            .select()
            .from(workspaceProfileSignals)
            .where(and(...conditions))
            .orderBy(desc(workspaceProfileSignals.createdAt))
            .limit(options.limit)

        return signals
    }

    async countByType(
        workspaceId: string,
        signalType: string,
        daysBack: number
    ): Promise<number> {
        this.logger.info('Counting signals by type', { workspaceId, signalType, daysBack })

        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)

        const [result] = await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(workspaceProfileSignals)
            .where(
                and(
                    eq(workspaceProfileSignals.workspaceId, workspaceId),
                    eq(workspaceProfileSignals.signalType, signalType),
                    gte(workspaceProfileSignals.createdAt, cutoffDate)
                )
            )

        return result?.count ?? 0
    }

    async aggregateByType(
        workspaceId: string,
        options: AggregateOptions
    ): Promise<AggregateResult[]> {
        this.logger.info('Aggregating signals by type', { workspaceId, ...options })

        const daysBack = options.daysBack ?? 90
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysBack)

        const conditions = [
            eq(workspaceProfileSignals.workspaceId, workspaceId),
            gte(workspaceProfileSignals.createdAt, cutoffDate),
        ]

        if (options.signalTypes && options.signalTypes.length > 0) {
            // Use IN clause for multiple signal types
            conditions.push(
                sql`${workspaceProfileSignals.signalType} IN ${options.signalTypes}`
            )
        }

        // Aggregate signals by extracting values from signal_data
        // This query counts occurrences of each value within each signal type
        const results = await this.db.execute<{
            signal_type: string
            value: string
            count: string
            weight: string
        }>(sql`
            SELECT
                signal_type,
                jsonb_array_elements_text(
                    CASE
                        WHEN jsonb_typeof(signal_data) = 'array' THEN signal_data
                        WHEN jsonb_typeof(signal_data) = 'object' THEN jsonb_build_array(signal_data)
                        ELSE '[]'::jsonb
                    END
                ) as value,
                COUNT(*)::int as count,
                AVG(weight::float)::numeric(3,2) as weight
            FROM ${workspaceProfileSignals}
            WHERE ${and(...conditions)}
            GROUP BY signal_type, value
            ORDER BY signal_type, count DESC
        `)

        return results.rows.map((row) => ({
            signalType: row.signal_type,
            value: row.value,
            count: parseInt(row.count),
            weight: parseFloat(row.weight),
        }))
    }

    async deleteOlderThan(workspaceId: string, days: number): Promise<number> {
        this.logger.info('Deleting old workspace signals', { workspaceId, days })

        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        const result = await this.db
            .delete(workspaceProfileSignals)
            .where(
                and(
                    eq(workspaceProfileSignals.workspaceId, workspaceId),
                    sql`${workspaceProfileSignals.createdAt} < ${cutoffDate}`
                )
            )

        return result.rowCount ?? 0
    }
}
