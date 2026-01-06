import OpenAI from 'openai'
import axios from 'axios'
import type { ILogger } from '@/shared/logger/logger.interface'
import type {
    IBookIdentificationService,
    BookCoverAnalysis,
    BookSearchQuery,
    GoogleBooksSearchResult,
    GoogleBooksItem,
} from './book-identification-service.interface'
import type { BookMetadata } from '../../entity/raw-inspiration.schema'
import { getEnvVar } from '@/shared/utils/get-env-var'

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes'

export class BookIdentificationService implements IBookIdentificationService {
    private readonly openai: OpenAI
    private readonly googleBooksApiKey: string | null

    constructor(private readonly logger: ILogger) {
        const openaiApiKey = getEnvVar('OPENAI_API_KEY')
        this.openai = new OpenAI({ apiKey: openaiApiKey })

        // Google Books API key is optional (can work with limited quota without key)
        try {
            this.googleBooksApiKey = getEnvVar('GOOGLE_BOOKS_API_KEY')
        } catch {
            this.googleBooksApiKey = null
            this.logger.warn('GOOGLE_BOOKS_API_KEY not set, using limited quota', {
                operation: 'BookIdentificationService.constructor',
            })
        }
    }

    async searchBook(query: BookSearchQuery): Promise<BookMetadata | null> {
        if (!query.title && !query.author && !query.isbn) {
            return null
        }

        try {
            // Build search query
            const searchTerms: string[] = []

            if (query.isbn) {
                searchTerms.push(`isbn:${query.isbn}`)
            } else {
                if (query.title) {
                    searchTerms.push(`intitle:${query.title}`)
                }
                if (query.author) {
                    searchTerms.push(`inauthor:${query.author}`)
                }
            }

            const params: Record<string, string> = {
                q: searchTerms.join('+'),
                maxResults: '5',
                printType: 'books',
            }

            if (this.googleBooksApiKey) {
                params.key = this.googleBooksApiKey
            }

            this.logger.info('Searching Google Books API', {
                operation: 'BookIdentificationService.searchBook',
                query: params.q,
            })

            const response = await axios.get<GoogleBooksSearchResult>(GOOGLE_BOOKS_API_URL, {
                params,
                timeout: 10000,
            })

            if (!response.data.items || response.data.items.length === 0) {
                this.logger.info('No books found in Google Books', {
                    operation: 'BookIdentificationService.searchBook',
                    query: params.q,
                })
                return null
            }

            // Return the best match (first result)
            const bestMatch = response.data.items[0]
            return this.mapGoogleBookToMetadata(bestMatch)
        } catch (error) {
            this.logger.error('Failed to search Google Books', {
                operation: 'BookIdentificationService.searchBook',
                error: error instanceof Error ? error.message : 'Unknown error',
            })
            return null
        }
    }

    async searchByISBN(isbn: string): Promise<BookMetadata | null> {
        // Clean ISBN (remove dashes and spaces)
        const cleanIsbn = isbn.replace(/[-\s]/g, '')
        return this.searchBook({ isbn: cleanIsbn })
    }

    async enrichBookData(partialData: Partial<BookMetadata>): Promise<BookMetadata | null> {
        // Try ISBN first (most accurate)
        if (partialData.isbn13 || partialData.isbn) {
            const isbn = partialData.isbn13 || partialData.isbn!
            const result = await this.searchByISBN(isbn)
            if (result) {
                return { ...result, ...partialData, identificationConfidence: 0.95 }
            }
        }

        // Fall back to title + author search
        if (partialData.title) {
            const result = await this.searchBook({
                title: partialData.title,
                author: partialData.authors?.[0],
            })
            if (result) {
                // Merge partial data with enriched data
                return {
                    ...result,
                    ...partialData,
                    // Keep higher confidence if we had ISBN match
                    identificationConfidence: partialData.isbn ? 0.9 : 0.75,
                }
            }
        }

        return null
    }

    async analyzeBookCover(imageUrl: string): Promise<BookCoverAnalysis> {
        try {
            this.logger.info('Analyzing book cover with Vision API', {
                operation: 'BookIdentificationService.analyzeBookCover',
            })

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Analyze this book cover image and extract information.

Return a JSON object with:
{
    "detectedTitle": "exact title text visible on cover or null",
    "detectedAuthor": "author name visible on cover or null", 
    "detectedSubtitle": "subtitle if visible or null",
    "visualDescription": "brief description of what the cover shows",
    "coverStyle": "one of: minimalist, illustrated, photographic, typographic, abstract, vintage, modern",
    "dominantColors": ["array of 2-3 dominant colors"],
    "confidence": 0.0-1.0 (how confident you are in the title/author extraction)
}

Focus on accurately extracting the title and author as they appear on the cover.
If text is partially visible or unclear, indicate lower confidence.`,
                            },
                            {
                                type: 'image_url',
                                image_url: { url: imageUrl, detail: 'high' },
                            },
                        ],
                    },
                ],
                temperature: 0.2,
                max_tokens: 500,
                response_format: { type: 'json_object' },
            })

            const responseText = completion.choices[0]?.message?.content
            if (!responseText) {
                throw new Error('Empty response from Vision API')
            }

            const result = JSON.parse(responseText)

            this.logger.info('Book cover analysis completed', {
                operation: 'BookIdentificationService.analyzeBookCover',
                detectedTitle: result.detectedTitle,
                confidence: result.confidence,
            })

            return {
                detectedTitle: result.detectedTitle || null,
                detectedAuthor: result.detectedAuthor || null,
                detectedSubtitle: result.detectedSubtitle || null,
                visualDescription: result.visualDescription || '',
                coverStyle: result.coverStyle || 'other',
                dominantColors: result.dominantColors || [],
                confidence: result.confidence ?? 0.5,
            }
        } catch (error) {
            this.logger.error('Failed to analyze book cover', {
                operation: 'BookIdentificationService.analyzeBookCover',
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            return {
                detectedTitle: null,
                detectedAuthor: null,
                detectedSubtitle: null,
                visualDescription: 'Failed to analyze cover',
                coverStyle: 'unknown',
                dominantColors: [],
                confidence: 0,
            }
        }
    }

    async identifyBook(params: {
        imageUrl?: string
        userDescription?: string
        parsedContent?: string
        hints?: {
            possibleBookTitle?: string
            possibleAuthors?: string[]
        }
    }): Promise<BookMetadata | null> {
        const startTime = Date.now()

        this.logger.info('Starting book identification', {
            operation: 'BookIdentificationService.identifyBook',
            hasImage: !!params.imageUrl,
            hasDescription: !!params.userDescription,
            hasHints: !!params.hints,
        })

        let coverAnalysis: BookCoverAnalysis | null = null
        let bookMetadata: BookMetadata | null = null

        // Step 1: Analyze cover if we have an image
        if (params.imageUrl) {
            coverAnalysis = await this.analyzeBookCover(params.imageUrl)
        }

        // Step 2: Build search query from available data
        const searchTitle =
            coverAnalysis?.detectedTitle || params.hints?.possibleBookTitle || this.extractTitleFromContent(params)

        const searchAuthor =
            coverAnalysis?.detectedAuthor || params.hints?.possibleAuthors?.[0] || this.extractAuthorFromContent(params)

        // Step 3: Search Google Books
        if (searchTitle || searchAuthor) {
            bookMetadata = await this.searchBook({
                title: searchTitle || undefined,
                author: searchAuthor || undefined,
            })
        }

        // Step 4: If no results and we have cover analysis, try with different combinations
        if (!bookMetadata && coverAnalysis?.detectedTitle) {
            // Try just title
            bookMetadata = await this.searchBook({ title: coverAnalysis.detectedTitle })
        }

        // Step 5: Build final metadata
        if (bookMetadata) {
            // Enrich with cover analysis data
            if (coverAnalysis) {
                bookMetadata.thumbnailUrl = bookMetadata.thumbnailUrl || params.imageUrl
            }

            // Set confidence based on how we found it
            bookMetadata.identificationConfidence = this.calculateConfidence(coverAnalysis, bookMetadata, params)
            bookMetadata.dataSource = 'google_books'

            this.logger.info('Book identification completed', {
                operation: 'BookIdentificationService.identifyBook',
                title: bookMetadata.title,
                confidence: bookMetadata.identificationConfidence,
                durationMs: Date.now() - startTime,
            })

            return bookMetadata
        }

        // Step 6: If all else fails, create metadata from what we have
        if (coverAnalysis?.detectedTitle || params.hints?.possibleBookTitle) {
            const fallbackMetadata: BookMetadata = {
                title: coverAnalysis?.detectedTitle || params.hints?.possibleBookTitle || 'Unknown Book',
                authors: coverAnalysis?.detectedAuthor
                    ? [coverAnalysis.detectedAuthor]
                    : params.hints?.possibleAuthors || [],
                identificationConfidence: 0.3,
                dataSource: coverAnalysis ? 'vision_ocr' : 'manual',
                thumbnailUrl: params.imageUrl,
            }

            this.logger.info('Created fallback book metadata', {
                operation: 'BookIdentificationService.identifyBook',
                title: fallbackMetadata.title,
                durationMs: Date.now() - startTime,
            })

            return fallbackMetadata
        }

        this.logger.warn('Could not identify book', {
            operation: 'BookIdentificationService.identifyBook',
            durationMs: Date.now() - startTime,
        })

        return null
    }

    private mapGoogleBookToMetadata(item: GoogleBooksItem): BookMetadata {
        const info = item.volumeInfo
        const identifiers = info.industryIdentifiers || []

        const isbn10 = identifiers.find((id) => id.type === 'ISBN_10')?.identifier
        const isbn13 = identifiers.find((id) => id.type === 'ISBN_13')?.identifier

        return {
            title: info.title,
            authors: info.authors || [],
            isbn: isbn10,
            isbn13: isbn13,
            publisher: info.publisher,
            publishedDate: info.publishedDate,
            pageCount: info.pageCount,
            categories: info.categories,
            language: info.language,
            description: info.description,
            thumbnailUrl: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail,
            previewLink: info.previewLink,
            infoLink: info.infoLink,
            averageRating: info.averageRating,
            ratingsCount: info.ratingsCount,
            dataSource: 'google_books',
        }
    }

    private extractTitleFromContent(params: {
        userDescription?: string
        parsedContent?: string
    }): string | null {
        // Try to extract book title from user description
        if (params.userDescription) {
            // Common patterns like "Книга: Title" or "Book: Title"
            const patterns = [
                /(?:книга|book|title|название)[:\s]+["']?([^"'\n,]+)["']?/i,
                /["']([^"']+)["']\s+(?:by|автор)/i,
            ]

            for (const pattern of patterns) {
                const match = params.userDescription.match(pattern)
                if (match) {
                    return match[1].trim()
                }
            }
        }

        return null
    }

    private extractAuthorFromContent(params: {
        userDescription?: string
        parsedContent?: string
    }): string | null {
        if (params.userDescription) {
            // Common patterns like "by Author" or "автор: Author"
            const patterns = [/(?:by|автор|author)[:\s]+["']?([^"'\n,]+)["']?/i]

            for (const pattern of patterns) {
                const match = params.userDescription.match(pattern)
                if (match) {
                    return match[1].trim()
                }
            }
        }

        return null
    }

    private calculateConfidence(
        coverAnalysis: BookCoverAnalysis | null,
        metadata: BookMetadata,
        params: { hints?: { possibleBookTitle?: string } }
    ): number {
        let confidence = 0.5 // Base confidence

        // Boost if cover analysis title matches API result
        if (coverAnalysis?.detectedTitle && metadata.title) {
            const similarity = this.stringSimilarity(
                coverAnalysis.detectedTitle.toLowerCase(),
                metadata.title.toLowerCase()
            )
            if (similarity > 0.8) {
                confidence += 0.3
            } else if (similarity > 0.5) {
                confidence += 0.15
            }
        }

        // Boost if we have ISBN
        if (metadata.isbn || metadata.isbn13) {
            confidence += 0.2
        }

        // Boost if hints match
        if (params.hints?.possibleBookTitle && metadata.title) {
            const similarity = this.stringSimilarity(
                params.hints.possibleBookTitle.toLowerCase(),
                metadata.title.toLowerCase()
            )
            if (similarity > 0.7) {
                confidence += 0.1
            }
        }

        // Cap at 1.0
        return Math.min(confidence, 1.0)
    }

    private stringSimilarity(a: string, b: string): number {
        // Simple Jaccard similarity on words
        const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2))
        const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2))

        const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)))
        const union = new Set([...wordsA, ...wordsB])

        return union.size > 0 ? intersection.size / union.size : 0
    }
}

