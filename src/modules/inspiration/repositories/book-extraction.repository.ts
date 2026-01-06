import { eq, desc, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { schema } from '@/db/schema'
import type { IBookExtractionRepository } from './book-extraction-repository.interface'
import type { BookExtraction, InsertBookExtraction } from '../entity/book-extraction.schema'
import { bookExtractions } from '../entity/book-extraction.schema'

export class BookExtractionRepository implements IBookExtractionRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) {}

    async create(data: InsertBookExtraction): Promise<BookExtraction> {
        const [extraction] = await this.db.insert(bookExtractions).values(data).returning()
        return extraction
    }

    async findById(id: string): Promise<BookExtraction | undefined> {
        const [extraction] = await this.db.select().from(bookExtractions).where(eq(bookExtractions.id, id)).limit(1)
        return extraction
    }

    async findByInspirationId(rawInspirationId: string): Promise<BookExtraction | undefined> {
        const [extraction] = await this.db
            .select()
            .from(bookExtractions)
            .where(eq(bookExtractions.rawInspirationId, rawInspirationId))
            .limit(1)
        return extraction
    }

    async findByWorkspaceId(
        workspaceId: string,
        options?: { limit?: number; offset?: number }
    ): Promise<{ items: BookExtraction[]; total: number }> {
        const limit = options?.limit ?? 20
        const offset = options?.offset ?? 0

        const [items, countResult] = await Promise.all([
            this.db
                .select()
                .from(bookExtractions)
                .where(eq(bookExtractions.workspaceId, workspaceId))
                .orderBy(desc(bookExtractions.createdAt))
                .limit(limit)
                .offset(offset),
            this.db
                .select({ count: sql<number>`count(*)::int` })
                .from(bookExtractions)
                .where(eq(bookExtractions.workspaceId, workspaceId)),
        ])

        return {
            items,
            total: countResult[0]?.count ?? 0,
        }
    }

    async update(id: string, data: Partial<InsertBookExtraction>): Promise<BookExtraction | undefined> {
        const [updated] = await this.db
            .update(bookExtractions)
            .set(data)
            .where(eq(bookExtractions.id, id))
            .returning()
        return updated
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db.delete(bookExtractions).where(eq(bookExtractions.id, id)).returning({ id: bookExtractions.id })
        return result.length > 0
    }
}

