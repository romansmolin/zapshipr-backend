import type { RawInspiration } from '../entity/raw-inspiration.schema'
import type { InspirationWithExtraction } from '../entity/inspiration-with-extraction'

export interface CreateInspirationData {
    workspaceId: string
    userId: string
    type: 'image' | 'link' | 'text' | 'document'
    title: string
    content?: string
    userDescription?: string
    file?: Express.Multer.File
}

export interface GetInspirationsFilters {
    type?: 'image' | 'link' | 'text' | 'document'
    status?: 'processing' | 'completed' | 'failed'
    limit?: number
    offset?: number
}

export interface InspirationsListResponse {
    items: InspirationWithExtraction[]
    total: number
    limit: number
    offset: number
}

export interface IInspirationsService {
    createInspiration(data: CreateInspirationData): Promise<RawInspiration>
    getInspirations(workspaceId: string, filters?: GetInspirationsFilters): Promise<InspirationsListResponse>
    getInspirationById(id: string, workspaceId: string): Promise<InspirationWithExtraction | null>
    updateInspiration(id: string, workspaceId: string, userDescription: string): Promise<RawInspiration | null>
    deleteInspiration(id: string, workspaceId: string): Promise<boolean>
    retryInspiration(id: string, workspaceId: string, userId: string): Promise<RawInspiration>
}
