import type { BookExtraction, InsertBookExtraction } from '../entity/book-extraction.schema'

export interface IBookExtractionRepository {
    /**
     * Create a new book extraction
     */
    create(data: InsertBookExtraction): Promise<BookExtraction>

    /**
     * Find book extraction by ID
     */
    findById(id: string): Promise<BookExtraction | undefined>

    /**
     * Find book extraction by raw inspiration ID
     */
    findByInspirationId(rawInspirationId: string): Promise<BookExtraction | undefined>

    /**
     * Find all book extractions for a workspace
     */
    findByWorkspaceId(
        workspaceId: string,
        options?: {
            limit?: number
            offset?: number
        }
    ): Promise<{ items: BookExtraction[]; total: number }>

    /**
     * Update book extraction
     */
    update(id: string, data: Partial<InsertBookExtraction>): Promise<BookExtraction | undefined>

    /**
     * Delete book extraction
     */
    delete(id: string): Promise<boolean>
}

