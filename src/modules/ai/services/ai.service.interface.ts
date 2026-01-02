import type { PostPlatform } from '@/modules/post/schemas/posts.schemas'
import type { AiRequest } from '@/modules/ai/validation/ai.schemas'

export interface AiIntroductoryResult {
    id: string
    platform: PostPlatform
    language: string
    title: string | null
    text: string
    hashtags: string[]
    charCounts: {
        title: number | null
        text: number
    }
    warnings: string[]
}

export interface IAiService {
    generateIntroductoryCopy(userId: string, payload: AiRequest): Promise<AiIntroductoryResult[]>
}
