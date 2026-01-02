import type { InspirationsExtraction, InsertInspirationsExtraction } from '../entity/inspirations-extraction.schema'

export interface IInspirationsExtractionRepository {
    /**
     * Создать extraction
     */
    create(data: InsertInspirationsExtraction): Promise<InspirationsExtraction>

    /**
     * Найти extraction по rawInspirationId
     */
    findByRawInspirationId(rawInspirationId: string): Promise<InspirationsExtraction | undefined>

    /**
     * Найти extractions по workspaceId
     */
    findByWorkspaceId(workspaceId: string, limit?: number, offset?: number): Promise<InspirationsExtraction[]>

    /**
     * Удалить extraction
     */
    delete(id: string): Promise<boolean>
}

