import type { InspirationMetadata } from '../../entity/raw-inspiration.schema'

export interface PostIdea {
    idea: string
    format: string
    angle: string
}

export interface ExtractionData {
    summary: string
    keyTopics: string[]
    contentFormat: string
    tone: string[]
    targetAudience: string
    keyInsights: string[]
    postIdeas: PostIdea[]
    contentStructure: string
    visualStyle?: string
    suggestedTags: string[]
}

export interface ExtractionInput {
    type: 'image' | 'link' | 'text' | 'document'
    content: string
    userDescription?: string
    metadata?: InspirationMetadata
    imageUrl?: string // For Vision analysis of images
}

export interface ExtractionResult {
    extraction: ExtractionData
    llmModel: string
    tokensUsed: number
}

export interface ILLMExtractionService {
    /**
     * Создать extraction на основе контента
     * Для изображений использует Vision API для анализа
     */
    createExtraction(input: ExtractionInput): Promise<ExtractionResult>

    /**
     * Построить промпт для extraction
     */
    buildPromptForExtraction(input: ExtractionInput): string
}
