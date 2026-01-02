import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq, desc } from 'drizzle-orm'

import type { ILogger } from '@/shared/logger/logger.interface'
import { schema } from '@/db/schema'
import { formatError } from '@/shared/utils/forma-error'

import type { IInspirationsExtractionRepository } from './inspirations-extraction-repository.interface'
import { inspirationsExtractions, type InspirationsExtraction, type InsertInspirationsExtraction } from '../entity/inspirations-extraction.schema'

export class InspirationsExtractionRepository implements IInspirationsExtractionRepository {
    constructor(
        private readonly db: NodePgDatabase<typeof schema>,
        private readonly logger: ILogger
    ) {}

    async create(data: InsertInspirationsExtraction): Promise<InspirationsExtraction> {
        const [extraction] = await this.db
            .insert(inspirationsExtractions)
            .values(data)
            .returning()

        this.logger.info('Created inspiration extraction', {
            operation: 'InspirationsExtractionRepository.create',
            entity: 'inspirations_extractions',
            extractionId: extraction.id,
            rawInspirationId: extraction.rawInspirationId,
        })

        return extraction
    }

    async findByRawInspirationId(rawInspirationId: string): Promise<InspirationsExtraction | undefined> {
        const [extraction] = await this.db
            .select()
            .from(inspirationsExtractions)
            .where(eq(inspirationsExtractions.rawInspirationId, rawInspirationId))
            .limit(1)

        return extraction
    }

    async findByWorkspaceId(
        workspaceId: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<InspirationsExtraction[]> {
        const extractions = await this.db
            .select()
            .from(inspirationsExtractions)
            .where(eq(inspirationsExtractions.workspaceId, workspaceId))
            .orderBy(desc(inspirationsExtractions.createdAt))
            .limit(limit)
            .offset(offset)

        return extractions
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(inspirationsExtractions)
            .where(eq(inspirationsExtractions.id, id))
            .returning()

        const deleted = result.length > 0

        if (deleted) {
            this.logger.info('Deleted inspiration extraction', {
                operation: 'InspirationsExtractionRepository.delete',
                entity: 'inspirations_extractions',
                extractionId: id,
            })
        }

        return deleted
    }
}

