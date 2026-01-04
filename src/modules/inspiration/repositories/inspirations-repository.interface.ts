import type { RawInspiration, InsertRawInspiration } from '../entity/raw-inspiration.schema'
import type { InspirationWithExtraction } from '../entity/inspiration-with-extraction'

export interface InspirationFilters {
    type?: 'image' | 'link' | 'text' | 'document'
    status?: 'processing' | 'completed' | 'failed'
    limit?: number
    offset?: number
}

export interface IInspirationsRepository {
    create(data: InsertRawInspiration): Promise<RawInspiration>
    findById(id: string): Promise<RawInspiration | undefined>
    findByIdWithExtraction(id: string): Promise<InspirationWithExtraction | undefined>
    findByWorkspaceId(
        workspaceId: string,
        filters?: InspirationFilters
    ): Promise<{ items: RawInspiration[]; total: number }>
    findByWorkspaceIdWithExtraction(
        workspaceId: string,
        filters?: InspirationFilters
    ): Promise<{ items: InspirationWithExtraction[]; total: number }>
    update(id: string, data: Partial<InsertRawInspiration>): Promise<RawInspiration | undefined>
    delete(id: string): Promise<boolean>
    checkDuplicateUrl(workspaceId: string, url: string): Promise<boolean>
}
