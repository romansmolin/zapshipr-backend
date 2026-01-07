/**
 * Quote with optional timestamp
 */
export interface YouTubeQuote {
    /** Quote text */
    text: string

    /** Start timestamp in seconds (if known) */
    startSec: number | null

    /** End timestamp in seconds (if known) */
    endSec: number | null
}

/**
 * Content angle suggestion
 */
export interface ContentAngle {
    /** The angle or perspective */
    angle: string

    /** Why this angle works */
    whyItWorks: string
}

/**
 * Platform-specific drafts
 */
export interface PlatformDrafts {
    /** Threads/Twitter thread posts */
    threads: string[]

    /** X/Twitter single posts */
    x: string[]

    /** LinkedIn posts */
    linkedin: string[]

    /** Instagram captions */
    instagramCaption: string[]
}

/**
 * YouTube-specific extraction data
 * Extended schema for transcript-based content extraction
 */
export interface YouTubeExtractionData {
    /** Guessed title of the video */
    titleGuess: string

    /** Detected language of the content */
    language: string

    /** Summary of the content (2-3 sentences) */
    summary: string

    /** Key points/takeaways (5-15 items) */
    keyPoints: string[]

    /** Attention-grabbing hooks (10-30 items) */
    hooks: string[]

    /** Notable quotes with timestamps */
    quotes: YouTubeQuote[]

    /** Content angles with explanations */
    contentAngles: ContentAngle[]

    /** Ready-to-use drafts per platform */
    drafts: PlatformDrafts

    /** Suggested tags/topics */
    tags: string[]

    /** Tone of the content */
    tone: string
}

/**
 * JSON Schema for OpenAI structured outputs - YouTube extraction v1
 */
export function getYouTubeExtractionJsonSchema() {
    return {
        name: 'youtube_extraction_v1',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                titleGuess: {
                    type: 'string',
                    description: 'Best guess at the video title based on content',
                },
                language: {
                    type: 'string',
                    description: 'Language of the content (e.g., "en", "ru", "es")',
                },
                summary: {
                    type: 'string',
                    description: 'A 2-3 sentence summary of the video content',
                },
                keyPoints: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 5-15 key points or takeaways',
                },
                hooks: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 10-30 attention-grabbing hooks for social posts',
                },
                quotes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            text: { type: 'string', description: 'The quote text' },
                            startSec: {
                                type: ['number', 'null'],
                                description: 'Start timestamp in seconds (null if unknown)',
                            },
                            endSec: {
                                type: ['number', 'null'],
                                description: 'End timestamp in seconds (null if unknown)',
                            },
                        },
                        required: ['text', 'startSec', 'endSec'],
                    },
                    description: 'Array of 3-20 notable quotes with timestamps',
                },
                contentAngles: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            angle: { type: 'string', description: 'The content angle or perspective' },
                            whyItWorks: { type: 'string', description: 'Why this angle is effective' },
                        },
                        required: ['angle', 'whyItWorks'],
                    },
                    description: 'Array of 5-15 content angles with explanations',
                },
                drafts: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        threads: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of 2-5 thread-style posts',
                        },
                        x: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of 2-5 X/Twitter posts',
                        },
                        linkedin: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of 1-3 LinkedIn posts',
                        },
                        instagramCaption: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of 1-3 Instagram captions',
                        },
                    },
                    required: ['threads', 'x', 'linkedin', 'instagramCaption'],
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 5-25 relevant tags/topics',
                },
                tone: {
                    type: 'string',
                    description: 'Tone of the content (e.g., "educational", "motivational", "casual")',
                },
            },
            required: [
                'titleGuess',
                'language',
                'summary',
                'keyPoints',
                'hooks',
                'quotes',
                'contentAngles',
                'drafts',
                'tags',
                'tone',
            ],
        },
    }
}

/**
 * System prompt for YouTube transcript extraction
 */
export function getYouTubeExtractionSystemPrompt(): string {
    return `You are a Content Extractor specialized in analyzing video transcripts.

YOUR MISSION:
- Extract SPECIFIC, ACTIONABLE insights from video transcripts
- Generate ready-to-use social media content
- Identify memorable quotes and key moments

RULES:
1. Work ONLY with the provided transcript - do not invent facts
2. Be SPECIFIC - use actual names, numbers, frameworks from the video
3. If uncertain about something, phrase it neutrally
4. All output must be in English regardless of input language
5. Quotes should include approximate timestamps if detectable from context

FOR HOOKS:
- Create attention-grabbing first lines for social posts
- Use different styles: questions, bold statements, "I learned...", statistics, contrarian takes
- Each hook should be unique and scroll-stopping

FOR DRAFTS:
- Threads: Multi-post format, educational style
- X: Short, punchy, shareable
- LinkedIn: Professional, insight-focused
- Instagram: Visual-friendly, engaging captions

Return ONLY valid JSON matching the required schema.`
}

/**
 * Build user prompt for YouTube transcript extraction
 */
export function buildYouTubeExtractionPrompt(transcript: string, metadata?: {
    title?: string
    channelTitle?: string
    duration?: string
    preferredLanguage?: string
}): string {
    let prompt = 'Analyze the following video transcript and extract structured content ideas.\n\n'

    if (metadata) {
        if (metadata.title) prompt += `Video Title: ${metadata.title}\n`
        if (metadata.channelTitle) prompt += `Channel: ${metadata.channelTitle}\n`
        if (metadata.duration) prompt += `Duration: ${metadata.duration}\n`
        prompt += '\n'
    }

    prompt += `=== TRANSCRIPT ===\n${transcript}\n=== END TRANSCRIPT ===\n\n`

    prompt += `EXTRACTION REQUIREMENTS:
1. Extract 10-30 HOOKS - attention-grabbing first lines for social posts
2. Identify 5-15 KEY POINTS that someone should remember
3. Find 3-20 QUOTES - memorable statements (estimate timestamps if possible)
4. Suggest 5-15 CONTENT ANGLES with explanations
5. Create DRAFTS for each platform: Threads, X, LinkedIn, Instagram
6. Identify the main TOPICS/TAGS (5-25)
7. Determine the overall TONE

Be SPECIFIC to this video's actual content. No generic advice.`

    return prompt
}

