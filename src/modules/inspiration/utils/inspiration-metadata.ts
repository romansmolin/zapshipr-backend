export type InspirationMetadataSource = 'external' | 'youtube' | 'notion' | 'docs'

const isYouTubeUrl = (url: string): boolean => {
    return /youtube\.com\/watch/i.test(url) || /youtu\.be\//i.test(url) || /youtube\.com\/embed/i.test(url)
}

const isNotionUrl = (url: string): boolean => {
    return /notion\.so/i.test(url) || /notion\.site/i.test(url)
}

const extractYouTubeVideoId = (url: string): string | null => {
    const youtubePatterns = [
        /youtube\.com\/watch\?v=([^&]+)/i,
        /youtu\.be\/([^?]+)/i,
        /youtube\.com\/embed\/([^?]+)/i,
    ]

    for (const pattern of youtubePatterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }

    return null
}

export const buildInspirationMetadataSource = (
    type: 'image' | 'link' | 'text' | 'document',
    content?: string
): { source: InspirationMetadataSource; youTubeVideoId?: string } => {
    if (type === 'document') {
        return { source: 'docs' }
    }

    if (type === 'link' && content) {
        if (isYouTubeUrl(content)) {
            const youTubeVideoId = extractYouTubeVideoId(content) ?? undefined
            return youTubeVideoId ? { source: 'youtube', youTubeVideoId } : { source: 'youtube' }
        }

        if (isNotionUrl(content)) {
            return { source: 'notion' }
        }

        return { source: 'external' }
    }

    return { source: 'external' }
}
