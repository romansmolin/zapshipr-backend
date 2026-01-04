import type { RawInspiration } from './raw-inspiration.schema'
import type { InspirationsExtraction } from './inspirations-extraction.schema'

/**
 * Extraction data returned to frontend (without internal fields)
 */
export interface ExtractionResponse {
    id: string
    summary: string
    keyTopics: string[]
    contentFormat: string | null
    tone: string[]
    targetAudience: string | null
    keyInsights: string[]
    contentStructure: string | null
    visualStyle: string | null
    suggestedTags: string[]
    createdAt: Date
}

/**
 * Raw inspiration with extraction data for frontend
 */
export interface InspirationWithExtraction extends RawInspiration {
    extraction: ExtractionResponse | null
}

/**
 * Transform extraction entity to response format
 */
export function toExtractionResponse(extraction: InspirationsExtraction): ExtractionResponse {
    return {
        id: extraction.id,
        summary: extraction.summary,
        keyTopics: extraction.keyTopics,
        contentFormat: extraction.contentFormat,
        tone: extraction.tone,
        targetAudience: extraction.targetAudience,
        keyInsights: extraction.keyInsights,
        contentStructure: extraction.contentStructure,
        visualStyle: extraction.visualStyle,
        suggestedTags: extraction.suggestedTags,
        createdAt: extraction.createdAt,
    }
}


