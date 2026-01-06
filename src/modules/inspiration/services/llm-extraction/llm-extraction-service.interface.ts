import type { InspirationMetadata, BookMetadata } from '../../entity/raw-inspiration.schema'
import type { BookExtractionData } from '../../entity/book-extraction.schema'

export interface ExtractionData {
    summary: string
    keyTopics: string[]
    contentFormat: string
    tone: string[]
    targetAudience: string
    keyInsights: string[]
    postIdeas: string[]
    contentStructure: string
    visualStyle?: string
    suggestedTags: string[]
}

export interface ExtractionInput {
    type: 'image' | 'link' | 'text' | 'document'
    content: string
    userDescription?: string
    metadata?: InspirationMetadata
    imageUrl?: string
}

export interface ExtractionResult {
    extraction: ExtractionData
    llmModel: string
    tokensUsed: number
}

// === Book-specific extraction types ===

export interface BookExtractionInput {
    bookMetadata: BookMetadata
    parsedContent?: string // Content from the source (book summary, review, description)
    userDescription?: string
    imageUrl?: string // Cover image URL
}

export interface BookExtractionResult {
    extraction: BookExtractionData
    llmModel: string
    tokensUsed: number
    processingDurationMs: number
}

export interface ILLMExtractionService {
    /**
     * Создать extraction на основе контента (generic)
     */
    createExtraction(input: ExtractionInput): Promise<ExtractionResult>

    /**
     * Построить промпт для extraction
     */
    buildPromptForExtraction(input: ExtractionInput): string

    /**
     * Создать глубокий extraction для книги
     * Включает семантический анализ, ключевые идеи, фреймворки и рекомендации по контенту
     */
    createBookExtraction(input: BookExtractionInput): Promise<BookExtractionResult>

    /**
     * Построить промпт для book extraction
     */
    buildBookExtractionPrompt(input: BookExtractionInput): string
}
