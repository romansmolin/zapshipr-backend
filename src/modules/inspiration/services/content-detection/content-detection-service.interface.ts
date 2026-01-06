import type { DetectedContentCategory } from '../../entity/raw-inspiration.schema'

export interface ContentDetectionInput {
    type: 'image' | 'link' | 'text' | 'document'
    content?: string // URL, text content, or parsed document content
    imageUrl?: string // S3 URL for images
    userDescription?: string
    metadata?: {
        title?: string
        description?: string
        author?: string
        domain?: string
    }
}

export interface ContentDetectionResult {
    category: DetectedContentCategory
    confidence: number // 0-1
    reasoning: string // Why this category was chosen
    // Additional hints for downstream processing
    hints: {
        possibleBookTitle?: string
        possibleAuthors?: string[]
        isBookCover?: boolean
        isBookReview?: boolean
        isBookSummary?: boolean
        isBookstoreLink?: boolean
    }
}

export interface IContentDetectionService {
    /**
     * Detect what type of content this is (book, article, video, etc.)
     * Uses LLM + heuristics to determine content category
     */
    detectContentType(input: ContentDetectionInput): Promise<ContentDetectionResult>

    /**
     * Quick heuristic check if URL is from a known book platform
     */
    isBookPlatformUrl(url: string): boolean

    /**
     * Extract book hints from URL (Amazon ASIN, Goodreads ID, etc.)
     */
    extractBookHintsFromUrl(url: string): {
        platform: string
        bookId?: string
        isbn?: string
    } | null
}

