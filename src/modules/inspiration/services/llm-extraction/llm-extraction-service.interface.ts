export interface ExtractionData {
    summary: string
    keyTopics: string[]
    contentFormat: string
    tone: string[]
    targetAudience: string
    keyInsights: string[]
    contentStructure: string
    visualStyle?: string
    suggestedTags: string[]
}

import type { InspirationMetadata } from '../../entity/raw-inspiration.schema'

export interface ExtractionInput {
    type: 'image' | 'link' | 'text' | 'document'
    content: string
    userDescription?: string
    metadata?: InspirationMetadata
}

export interface ExtractionResult {
    extraction: ExtractionData
    llmModel: string
    tokensUsed: number
}

export interface ILLMExtractionService {
    /**
     * Создать extraction на основе контента
     */
    createExtraction(input: ExtractionInput): Promise<ExtractionResult>

    /**
     * Построить промпт для extraction
     */
    buildPromptForExtraction(input: ExtractionInput): string
}
