import { eq, and, sql, count, desc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'

import { rawInspirations } from '../entity/raw-inspiration.schema'
import { inspirationsExtractions } from '../entity/inspirations-extraction.schema'
import type { RawInspiration, InsertRawInspiration } from '../entity/raw-inspiration.schema'
import type { IInspirationsRepository, InspirationWithExtraction } from './inspirations-repository.interface'

export class InspirationsRepository implements IInspirationsRepository {
    private readonly db: NodePgDatabase<typeof dbSchema>
    private readonly logger: ILogger

    constructor(db: NodePgDatabase<typeof dbSchema>, logger: ILogger) {
        this.db = db
        this.logger = logger
    }

    async create(data: InsertRawInspiration): Promise<RawInspiration> {
        try {
            const [inspiration] = await this.db
                .insert(rawInspirations)
                .values({
                    ...data,
                    updatedAt: new Date(),
                })
                .returning()

            this.logger.info('Created raw inspiration', {
                operation: 'InspirationsRepository.create',
                entity: 'raw_inspirations',
                inspirationId: inspiration.id,
                workspaceId: inspiration.workspaceId,
                type: inspiration.type,
            })

            return inspiration
        } catch (error) {
            this.logger.error('Failed to create raw inspiration', {
                operation: 'InspirationsRepository.create',
                entity: 'raw_inspirations',
                error: formatError(error),
            })
            throw error
        }
    }

    async findById(id: string): Promise<RawInspiration | undefined> {
        try {
            const [inspiration] = await this.db
                .select()
                .from(rawInspirations)
                .where(eq(rawInspirations.id, id))
                .limit(1)

            return inspiration
        } catch (error) {
            this.logger.error('Failed to fetch inspiration by id', {
                operation: 'InspirationsRepository.findById',
                entity: 'raw_inspirations',
                inspirationId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async findByIdWithExtraction(id: string): Promise<InspirationWithExtraction | undefined> {
        try {
            const results = await this.db
                .select({
                    inspiration: rawInspirations,
                    extraction: inspirationsExtractions,
                })
                .from(rawInspirations)
                .leftJoin(
                    inspirationsExtractions,
                    eq(rawInspirations.id, inspirationsExtractions.rawInspirationId)
                )
                .where(eq(rawInspirations.id, id))
                .limit(1)

            if (results.length === 0) {
                return undefined
            }

            const { inspiration, extraction } = results[0]

            return {
                ...inspiration,
                extraction: extraction || null,
            }
        } catch (error) {
            this.logger.error('Failed to fetch inspiration with extraction', {
                operation: 'InspirationsRepository.findByIdWithExtraction',
                entity: 'raw_inspirations',
                inspirationId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async findByWorkspaceId(
        workspaceId: string,
        filters?: {
            type?: 'image' | 'link' | 'text' | 'document'
            status?: 'processing' | 'completed' | 'failed'
            limit?: number
            offset?: number
        }
    ): Promise<{ items: InspirationWithExtraction[]; total: number }> {
        try {
            const limit = filters?.limit ?? 20
            const offset = filters?.offset ?? 0

            const conditions = [eq(rawInspirations.workspaceId, workspaceId)]

            if (filters?.type) {
                conditions.push(eq(rawInspirations.type, filters.type))
            }

            if (filters?.status) {
                conditions.push(eq(rawInspirations.status, filters.status))
            }

            const whereClause = and(...conditions)

            // Join with extractions
            const results = await this.db
                .select({
                    inspiration: rawInspirations,
                    extraction: inspirationsExtractions,
                })
                .from(rawInspirations)
                .leftJoin(
                    inspirationsExtractions,
                    eq(rawInspirations.id, inspirationsExtractions.rawInspirationId)
                )
                .where(whereClause)
                .orderBy(desc(rawInspirations.createdAt))
                .limit(limit)
                .offset(offset)

            const items: InspirationWithExtraction[] = results.map(({ inspiration, extraction }) => ({
                ...inspiration,
                extraction: extraction || null,
            }))

            const [{ value: total }] = await this.db
                .select({ value: count() })
                .from(rawInspirations)
                .where(whereClause)

            return { items, total }
        } catch (error) {
            this.logger.error('Failed to fetch inspirations by workspace', {
                operation: 'InspirationsRepository.findByWorkspaceId',
                entity: 'raw_inspirations',
                workspaceId,
                error: formatError(error),
            })
            throw error
        }
    }

    async update(id: string, data: Partial<InsertRawInspiration>): Promise<RawInspiration | undefined> {
        try {
            const [updated] = await this.db
                .update(rawInspirations)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(rawInspirations.id, id))
                .returning()

            if (updated) {
                this.logger.info('Updated raw inspiration', {
                    operation: 'InspirationsRepository.update',
                    entity: 'raw_inspirations',
                    inspirationId: id,
                })
            }

            return updated
        } catch (error) {
            this.logger.error('Failed to update inspiration', {
                operation: 'InspirationsRepository.update',
                entity: 'raw_inspirations',
                inspirationId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const result = await this.db.delete(rawInspirations).where(eq(rawInspirations.id, id)).returning()

            const deleted = result.length > 0

            if (deleted) {
                this.logger.info('Deleted raw inspiration', {
                    operation: 'InspirationsRepository.delete',
                    entity: 'raw_inspirations',
                    inspirationId: id,
                })
            }

            return deleted
        } catch (error) {
            this.logger.error('Failed to delete inspiration', {
                operation: 'InspirationsRepository.delete',
                entity: 'raw_inspirations',
                inspirationId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async checkDuplicateUrl(workspaceId: string, url: string): Promise<boolean> {
        try {
            const [existing] = await this.db
                .select({ id: rawInspirations.id })
                .from(rawInspirations)
                .where(
                    and(
                        eq(rawInspirations.workspaceId, workspaceId),
                        eq(rawInspirations.content, url),
                        eq(rawInspirations.type, 'link')
                    )
                )
                .limit(1)

            return !!existing
        } catch (error) {
            this.logger.error('Failed to check duplicate URL', {
                operation: 'InspirationsRepository.checkDuplicateUrl',
                entity: 'raw_inspirations',
                workspaceId,
                error: formatError(error),
            })
            throw error
        }
    }
}
