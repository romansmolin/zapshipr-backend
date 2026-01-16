import type { InspirationMetadata } from '../../entity/raw-inspiration.schema'

export interface PostIdea {
    idea: string
    format: string
    angle: string
}

export interface KeyInsight {
    insight: string
    evidence: string
    whyItWorks: string
    causeEffect: string
}

export interface MentalModel {
    name: string
    description: string
    steps: string[]
}

export interface AuthorIntent {
    problem: string
    worldview: string
    intendedOutcome: string
}

export interface UseCaseInsight {
    insight: string
    useCases: string[]
}

export interface StructuredInsights {
    documentType: string
    coreIdeas: string[]
    repeatedThemes: string[]
    mentalModels: MentalModel[]
    authorIntent: AuthorIntent
    moodTone: string[]
    narrativeFlow: string[]
    useCaseInsights: UseCaseInsight[]
}

export interface ExtractionData {
    summary: string
    keyTopics: string[]
    contentFormat: string
    tone: string[]
    targetAudience: string
    keyInsights: KeyInsight[]
    postIdeas: PostIdea[]
    contentStructure: string
    visualStyle?: string
    suggestedTags: string[]
    structuredInsights: StructuredInsights
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
    buildPromptForExtraction(input: ExtractionInput): string
}
