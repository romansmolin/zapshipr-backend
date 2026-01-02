export interface IPinterestBoardResponse {
    items?: Array<{
        id: string
        name: string
        description?: string | null
        privacy?: string | null
        owner?: {
            username?: string | null
        }
        media?: {
            image_cover_url?: string | null
        }
    }>
}
