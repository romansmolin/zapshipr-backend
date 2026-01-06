import OpenAI from 'openai'
import type { ILogger } from '@/shared/logger/logger.interface'
import type {
    IContentDetectionService,
    ContentDetectionInput,
    ContentDetectionResult,
} from './content-detection-service.interface'
import type { DetectedContentCategory } from '../../entity/raw-inspiration.schema'
import { getEnvVar } from '@/shared/utils/get-env-var'

// Known book platform patterns
const BOOK_PLATFORM_PATTERNS = [
    { pattern: /amazon\.[a-z.]+\/.*?(dp|gp\/product)\/([A-Z0-9]{10})/i, platform: 'amazon', idGroup: 2 },
    { pattern: /goodreads\.com\/book\/show\/(\d+)/i, platform: 'goodreads', idGroup: 1 },
    { pattern: /books\.google\.[a-z.]+\/books.*?[?&]id=([^&]+)/i, platform: 'google_books', idGroup: 1 },
    { pattern: /openlibrary\.org\/books\/([^\/]+)/i, platform: 'open_library', idGroup: 1 },
    { pattern: /litres\.ru\/book\/([^\/]+)/i, platform: 'litres', idGroup: 1 },
    { pattern: /labirint\.ru\/books\/(\d+)/i, platform: 'labirint', idGroup: 1 },
    { pattern: /ozon\.ru\/product\/.*?(\d+)/i, platform: 'ozon', idGroup: 1 },
    { pattern: /barnesandnoble\.com\/w\/([^\/]+)/i, platform: 'barnes_noble', idGroup: 1 },
    { pattern: /bookdepository\.com\/([^\/]+)/i, platform: 'book_depository', idGroup: 1 },
]

// ISBN patterns
const ISBN_PATTERNS = [
    /ISBN[-:\s]*(1[03])[-\s]*(\d[-\s]*){9}[\dXx]/gi,
    /ISBN[-:\s]*(\d[-\s]*){9}[\dXx]/gi,
    /978[-\s]*(\d[-\s]*){10}/g,
    /979[-\s]*(\d[-\s]*){10}/g,
]

export class ContentDetectionService implements IContentDetectionService {
    private readonly openai: OpenAI
    private readonly model: string = 'gpt-4o-mini' // Use mini for cost efficiency on detection

    constructor(private readonly logger: ILogger) {
        const apiKey = getEnvVar('OPENAI_API_KEY')
        this.openai = new OpenAI({ apiKey })
    }

    async detectContentType(input: ContentDetectionInput): Promise<ContentDetectionResult> {
        // Step 1: Quick heuristic checks
        if (input.type === 'link' && input.content) {
            const urlHints = this.extractBookHintsFromUrl(input.content)
            if (urlHints) {
                this.logger.info('Detected book platform URL', {
                    operation: 'ContentDetectionService.detectContentType',
                    platform: urlHints.platform,
                })
                return {
                    category: 'book',
                    confidence: 0.95,
                    reasoning: `URL is from known book platform: ${urlHints.platform}`,
                    hints: {
                        isBookstoreLink: true,
                        possibleBookTitle: input.metadata?.title,
                    },
                }
            }
        }

        // Step 2: Check for ISBN in text content
        if (input.content) {
            const isbn = this.extractISBN(input.content)
            if (isbn) {
                return {
                    category: 'book',
                    confidence: 0.98,
                    reasoning: `Found ISBN in content: ${isbn}`,
                    hints: {
                        possibleBookTitle: input.metadata?.title,
                    },
                }
            }
        }

        // Step 3: Use LLM for content analysis
        return this.detectWithLLM(input)
    }

    isBookPlatformUrl(url: string): boolean {
        return BOOK_PLATFORM_PATTERNS.some((p) => p.pattern.test(url))
    }

    extractBookHintsFromUrl(url: string): { platform: string; bookId?: string; isbn?: string } | null {
        for (const { pattern, platform, idGroup } of BOOK_PLATFORM_PATTERNS) {
            const match = url.match(pattern)
            if (match) {
                return {
                    platform,
                    bookId: match[idGroup],
                }
            }
        }
        return null
    }

    private extractISBN(text: string): string | null {
        for (const pattern of ISBN_PATTERNS) {
            const match = text.match(pattern)
            if (match) {
                // Clean ISBN (remove dashes and spaces)
                return match[0].replace(/[-\s:ISBN]/gi, '')
            }
        }
        return null
    }

    private async detectWithLLM(input: ContentDetectionInput): Promise<ContentDetectionResult> {
        const prompt = this.buildDetectionPrompt(input)

        try {
            this.logger.info('Calling LLM for content detection', {
                operation: 'ContentDetectionService.detectWithLLM',
                inputType: input.type,
            })

            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                {
                    role: 'system',
                    content: `You are a content classifier. Analyze the provided content and determine its category.
                    
Categories:
- book: Books, book summaries, book reviews, book covers, book recommendations
- article: Blog posts, news articles, essays, web pages
- video: YouTube videos, video content descriptions
- social_post: Social media posts, tweets, LinkedIn posts
- podcast: Podcast episodes, audio content
- course: Online courses, educational materials, tutorials
- other: Anything that doesn't fit above categories

Return JSON with:
- category: one of the categories above
- confidence: 0-1 how confident you are
- reasoning: brief explanation
- hints: object with possibleBookTitle, possibleAuthors (array), isBookCover, isBookReview, isBookSummary`,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ]

            // If we have an image, use vision
            if (input.type === 'image' && input.imageUrl) {
                messages[1] = {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: { url: input.imageUrl, detail: 'low' },
                        },
                    ],
                }
            }

            const completion = await this.openai.chat.completions.create({
                model: input.type === 'image' ? 'gpt-4o' : this.model,
                messages,
                temperature: 0.3,
                max_tokens: 500,
                response_format: { type: 'json_object' },
            })

            const responseText = completion.choices[0]?.message?.content
            if (!responseText) {
                throw new Error('Empty response from OpenAI')
            }

            const result = JSON.parse(responseText)

            this.logger.info('Content detection completed', {
                operation: 'ContentDetectionService.detectWithLLM',
                category: result.category,
                confidence: result.confidence,
            })

            return {
                category: result.category as DetectedContentCategory,
                confidence: result.confidence ?? 0.5,
                reasoning: result.reasoning ?? 'LLM analysis',
                hints: {
                    possibleBookTitle: result.hints?.possibleBookTitle,
                    possibleAuthors: result.hints?.possibleAuthors,
                    isBookCover: result.hints?.isBookCover,
                    isBookReview: result.hints?.isBookReview,
                    isBookSummary: result.hints?.isBookSummary,
                    isBookstoreLink: false,
                },
            }
        } catch (error) {
            this.logger.error('Failed to detect content type with LLM', {
                operation: 'ContentDetectionService.detectWithLLM',
                error: error instanceof Error ? error.message : 'Unknown error',
            })

            // Fallback to 'other' category
            return {
                category: 'other',
                confidence: 0.3,
                reasoning: 'Failed to analyze content, defaulting to other',
                hints: {},
            }
        }
    }

    private buildDetectionPrompt(input: ContentDetectionInput): string {
        let prompt = `Analyze this content and determine its category.\n\n`

        prompt += `Input Type: ${input.type}\n`

        if (input.userDescription) {
            prompt += `User Description: ${input.userDescription}\n`
        }

        if (input.metadata?.title) {
            prompt += `Title: ${input.metadata.title}\n`
        }

        if (input.metadata?.author) {
            prompt += `Author: ${input.metadata.author}\n`
        }

        if (input.metadata?.domain) {
            prompt += `Domain: ${input.metadata.domain}\n`
        }

        if (input.content && input.type !== 'image') {
            // Truncate content for detection (don't need full text)
            const truncatedContent = input.content.substring(0, 2000)
            prompt += `\nContent Preview:\n${truncatedContent}`
            if (input.content.length > 2000) {
                prompt += '\n[... content truncated ...]'
            }
        }

        if (input.type === 'image') {
            prompt += `\nThis is an image. Please analyze what type of content it represents.`
            if (input.userDescription) {
                prompt += ` The user described it as: "${input.userDescription}"`
            }
        }

        return prompt
    }
}

