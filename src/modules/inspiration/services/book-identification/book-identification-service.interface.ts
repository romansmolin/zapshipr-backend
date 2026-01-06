import type { BookMetadata } from '../../entity/raw-inspiration.schema'

export interface GoogleBooksSearchResult {
    kind: string
    totalItems: number
    items?: GoogleBooksItem[]
}

export interface GoogleBooksItem {
    id: string
    volumeInfo: {
        title: string
        authors?: string[]
        publisher?: string
        publishedDate?: string
        description?: string
        industryIdentifiers?: {
            type: string // ISBN_10, ISBN_13, OTHER
            identifier: string
        }[]
        pageCount?: number
        categories?: string[]
        averageRating?: number
        ratingsCount?: number
        language?: string
        imageLinks?: {
            smallThumbnail?: string
            thumbnail?: string
            small?: string
            medium?: string
            large?: string
        }
        previewLink?: string
        infoLink?: string
    }
}

export interface BookCoverAnalysis {
    detectedTitle: string | null
    detectedAuthor: string | null
    detectedSubtitle: string | null
    visualDescription: string
    coverStyle: string // minimalist, illustrated, photo-based, etc.
    dominantColors: string[]
    confidence: number // 0-1
}

export interface BookSearchQuery {
    title?: string
    author?: string
    isbn?: string
}

export interface IBookIdentificationService {
    /**
     * Search for a book by title and/or author using Google Books API
     */
    searchBook(query: BookSearchQuery): Promise<BookMetadata | null>

    /**
     * Search for a book by ISBN using Google Books API
     */
    searchByISBN(isbn: string): Promise<BookMetadata | null>

    /**
     * Enrich partial book data with external sources
     */
    enrichBookData(partialData: Partial<BookMetadata>): Promise<BookMetadata | null>

    /**
     * Analyze book cover image using Vision API (GPT-4o)
     * Extracts title, author, visual style from cover image
     */
    analyzeBookCover(imageUrl: string): Promise<BookCoverAnalysis>

    /**
     * Full identification flow: analyze cover + search + enrich
     * Combines Vision analysis with API lookup for best results
     */
    identifyBook(params: {
        imageUrl?: string
        userDescription?: string
        parsedContent?: string
        hints?: {
            possibleBookTitle?: string
            possibleAuthors?: string[]
        }
    }): Promise<BookMetadata | null>
}
