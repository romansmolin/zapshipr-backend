export interface MediaItem {
    key: string
    url: string
    signedUrl?: string
    size?: number
    lastModified?: string
    contentType?: string
}

export interface ListUserImagesResponse {
    items: MediaItem[]
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
}
