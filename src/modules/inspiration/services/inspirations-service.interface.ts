import type { RawInspiration } from '../entity/raw-inspiration.schema'

export interface CreateInspirationData {
    workspaceId: string
    userId: string
    type: 'image' | 'link' | 'text' | 'document'
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
    items: RawInspiration[]
    total: number
    limit: number
    offset: number
}

export interface IInspirationsService {
    createInspiration(data: CreateInspirationData): Promise<RawInspiration>
    getInspirations(workspaceId: string, filters?: GetInspirationsFilters): Promise<InspirationsListResponse>
    getInspirationById(id: string): Promise<RawInspiration | null>
    updateInspiration(id: string, userDescription: string): Promise<RawInspiration | null>
    deleteInspiration(id: string): Promise<boolean>
}
