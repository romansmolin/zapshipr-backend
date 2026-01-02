import type { RawInspiration, InsertRawInspiration } from '../entity/raw-inspiration.schema'

export interface IInspirationsRepository {
    create(data: InsertRawInspiration): Promise<RawInspiration>
    findById(id: string): Promise<RawInspiration | undefined>
    findByWorkspaceId(
        workspaceId: string,
        filters?: {
            type?: 'image' | 'link' | 'text' | 'document'
            status?: 'processing' | 'completed' | 'failed'
            limit?: number
            offset?: number
        }
    ): Promise<{ items: RawInspiration[]; total: number }>
    update(id: string, data: Partial<InsertRawInspiration>): Promise<RawInspiration | undefined>
    delete(id: string): Promise<boolean>
    checkDuplicateUrl(workspaceId: string, url: string): Promise<boolean>
}
