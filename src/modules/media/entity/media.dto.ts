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
    nextCursor?: string
    hasMore: boolean
}
