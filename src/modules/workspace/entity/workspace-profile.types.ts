export type CompletionLevel = 'quick_start' | 'partial' | 'complete'

export interface WorkspaceAIContext {
    workspaceId: string
    goal: {
        primary: string
        outcome?: string
        signals?: string[]
    }
    audience: {
        type: string
        awarenessLevel?: string
        painPoints?: string
        languages: string[]
    }
    voice: {
        tones: string[]
        brandType?: string
        perspective?: string
        personalityAnchors?: Record<string, any>
    }
    contentStrategy: {
        topics?: string[]
        pillars: string[]
        formats?: string[]
    }
    constraints: {
        platforms: string[]
        hardConstraints: string[]
        forbiddenWords: string[]
    }
    sales: {
        profile: string
        policy: Record<string, any>
    }
    tags: {
        topics: string[]
        formats: string[]
        tones: string[]
        styles: string[]
        other: string[]
    }
    learned: {
        frequentTones: string[]
        frequentFormats: string[]
        frequentTopics: string[]
        preferredPlatforms: string[]
        avgContentLength: number | null
        confidence: number
    }
    meta: {
        version: number
        completionLevel: CompletionLevel
        completionScore: number
        lastUpdated: string
    }
}

export interface ProfileSignalInput {
    type: string
    source: string
    data: Record<string, any>
    weight?: number
}

export interface LearnedPreferences {
    frequentTones: string[]
    frequentFormats: string[]
    frequentTopics: string[]
    preferredPlatforms: string[]
    avgContentLength: number | null
    confidence: number
    lastUpdated: Date
}

export interface AggregateOptions {
    daysBack?: number
    signalTypes?: string[]
}

export interface AggregateResult {
    signalType: string
    value: string
    count: number
    weight: number
}
