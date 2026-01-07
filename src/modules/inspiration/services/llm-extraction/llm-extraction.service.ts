import OpenAI from 'openai'
import type { ILogger } from '@/shared/logger/logger.interface'
import type {
    ILLMExtractionService,
    ExtractionInput,
    ExtractionResult,
    ExtractionData,
} from './llm-extraction-service.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { getEnvVar } from '@/shared/utils/get-env-var'

export class LLMExtractionService implements ILLMExtractionService {
    private readonly openai: OpenAI
    private readonly model: string = 'gpt-4o'
    private readonly maxRetries = 3

    constructor(private readonly logger: ILogger) {
        const apiKey = getEnvVar('OPENAI_API_KEY')

        this.openai = new OpenAI({
            apiKey,
        })
    }

    async createExtraction(input: ExtractionInput): Promise<ExtractionResult> {
        // Use Vision when imageUrl is available (images or links with thumbnails)
        if (input.imageUrl) {
            return this.createExtractionWithVision(input)
        }

        return this.createTextExtraction(input)
    }

    /**
     * Standard text-based extraction
     */
    private async createTextExtraction(input: ExtractionInput): Promise<ExtractionResult> {
        const prompt = this.buildPromptForExtraction(input)

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.logger.info('Calling OpenAI API for extraction', {
                    operation: 'LLMExtractionService.createExtraction',
                    attempt,
                    model: this.model,
                    type: input.type,
                })

                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: this.getSystemPrompt(),
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 1500,
                    response_format: {
                        type: 'json_schema',
                        json_schema: this.getExtractionJsonSchema(),
                    },
                })

                const responseText = completion.choices[0]?.message?.content

                if (!responseText) {
                    throw new Error('Empty response from OpenAI')
                }

                const extraction = this.parseExtractionResponse(responseText)
                const tokensUsed = completion.usage?.total_tokens || 0

                this.logger.info('Successfully created extraction', {
                    operation: 'LLMExtractionService.createExtraction',
                    model: this.model,
                    tokensUsed,
                    attempt,
                })

                return {
                    extraction,
                    llmModel: this.model,
                    tokensUsed,
                }
            } catch (error) {
                lastError = error as Error
                this.logger.warn('Failed to create extraction', {
                    operation: 'LLMExtractionService.createExtraction',
                    attempt,
                    error: lastError.message,
                })

                if (attempt === this.maxRetries) {
                    break
                }

                await this.delay(Math.pow(2, attempt) * 1000)
            }
        }

        this.logger.error('All retry attempts failed for extraction', {
            operation: 'LLMExtractionService.createExtraction',
            error: lastError?.message,
        })

        throw new AppError({
            errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
            message: `Failed to create extraction after ${this.maxRetries} attempts: ${lastError?.message}`,
            httpCode: 500,
        })
    }

    /**
     * Vision-based extraction for images
     */
    private async createExtractionWithVision(input: ExtractionInput): Promise<ExtractionResult> {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.logger.info('Calling OpenAI Vision API for image extraction', {
                    operation: 'LLMExtractionService.createExtractionWithVision',
                    attempt,
                    model: this.model,
                })

                const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                    {
                        role: 'system',
                        content: this.getVisionSystemPrompt(),
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: input.imageUrl!,
                                    detail: 'high',
                                },
                            },
                            {
                                type: 'text',
                                text: this.buildVisionPrompt(input),
                            },
                        ],
                    },
                ]

                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages,
                    temperature: 0.7,
                    max_tokens: 2000,
                    response_format: {
                        type: 'json_schema',
                        json_schema: this.getExtractionJsonSchema(),
                    },
                })

                const responseText = completion.choices[0]?.message?.content

                if (!responseText) {
                    throw new Error('Empty response from OpenAI Vision')
                }

                const extraction = this.parseExtractionResponse(responseText)
                const tokensUsed = completion.usage?.total_tokens || 0

                this.logger.info('Successfully created Vision extraction', {
                    operation: 'LLMExtractionService.createExtractionWithVision',
                    model: this.model,
                    tokensUsed,
                    attempt,
                })

                return {
                    extraction,
                    llmModel: this.model,
                    tokensUsed,
                }
            } catch (error) {
                lastError = error as Error
                this.logger.warn('Failed to create Vision extraction', {
                    operation: 'LLMExtractionService.createExtractionWithVision',
                    attempt,
                    error: lastError.message,
                })

                if (attempt === this.maxRetries) {
                    break
                }

                await this.delay(Math.pow(2, attempt) * 1000)
            }
        }

        this.logger.error('All retry attempts failed for Vision extraction', {
            operation: 'LLMExtractionService.createExtractionWithVision',
            error: lastError?.message,
        })

        throw new AppError({
            errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
            message: `Failed to create Vision extraction after ${this.maxRetries} attempts: ${lastError?.message}`,
            httpCode: 500,
        })
    }

    buildPromptForExtraction(input: ExtractionInput): string {
        let prompt = `Analyze the following content and extract structured insights.\n\n`

        prompt += `Content Type: ${input.type}\n\n`

        if (input.userDescription) {
            prompt += `User Description: ${input.userDescription}\n\n`
        }

        if (input.metadata) {
            prompt += `Metadata:\n${JSON.stringify(input.metadata, null, 2)}\n\n`
        }

        prompt += `Content:\n${input.content}\n\n`

        // Add specific guidelines based on content type
        const isYouTube = input.metadata?.domain === 'youtube.com'
        const isVideo = isYouTube || input.metadata?.domain === 'vimeo.com'

        if (isVideo) {
            prompt += `VIDEO ANALYSIS GUIDELINES:
- What is the MAIN THESIS or argument of this video?
- What are the KEY TAKEAWAYS someone should remember?
- Are there any FRAMEWORKS, METHODS, or STEP-BY-STEP processes mentioned?
- What makes this content unique or valuable?
- What would someone TWEET after watching this?

POST IDEAS REQUIREMENTS:
- Generate 5-7 specific post ideas based on this video
- Each idea should have a HOOK that stops scrolling
- Include different angles: educational, controversial, "I tried this...", statistics-based
- Example hooks:
  * "I watched [Creator]'s video on [Topic] and here's the #1 thing most people miss..."
  * "Unpopular opinion: [Creator] is wrong about [specific point]..."
  * "The 3-step framework from [Video] that changed how I think about [Topic]..."

Be SPECIFIC to this video's actual content - no generic advice.`
        } else {
            prompt += `Guidelines:
- Provide a clear 2-3 sentence summary
- Extract 3-7 key topics that represent main themes
- Identify 2-4 tone attributes (professional, casual, humorous, educational, inspirational, etc.)
- Provide 3-5 actionable key insights or takeaways
- Generate 5-7 specific POST IDEAS with hooks and angles
- Suggest 5-10 relevant tags that could categorize this content
- Describe the content structure (hook, body, call-to-action, etc.)
- Focus on insights that would help create similar content`
        }

        return prompt
    }

    private buildVisionPrompt(input: ExtractionInput): string {
        let prompt = ''

        // For links with thumbnails, include both image and content
        if (input.type === 'link' && input.content) {
            prompt += `Analyze this article/video thumbnail AND its content to extract insights.\n\n`
            prompt += `=== ARTICLE CONTENT ===\n${input.content.substring(0, 3000)}\n\n`
            if (input.metadata) {
                prompt += `Title: ${input.metadata.title || 'Unknown'}\n`
                prompt += `Domain: ${input.metadata.domain || 'Unknown'}\n\n`
            }
        } else {
            prompt += `Analyze this image carefully and extract structured insights for content creation.\n\n`
        }

        if (input.userDescription) {
            prompt += `User's context: ${input.userDescription}\n\n`
        }

        prompt += `ANALYSIS INSTRUCTIONS:

1. IDENTIFY what's in the image:
   - Book cover → Identify the book, author, and extract the book's core ideas
   - Infographic → Extract data points, statistics, and insights
   - Screenshot → Extract the key information shown
   - Photo/artwork → Describe themes, mood, and content potential
   - Quote image → Extract and analyze the quote

2. FOR BOOK COVERS specifically:
   - Identify the book title and author
   - Extract 3-5 MAIN IDEAS the book is known for (research your knowledge)
   - Identify KEY FRAMEWORKS or methodologies from the book
   - Extract MEMORABLE QUOTES or concepts
   - Think about what makes this book valuable for the target reader

3. GENERATE POST IDEAS:
   For each insight, create a specific post idea with:
   - A compelling hook (first line that grabs attention)
   - The format (carousel, thread, video, story, reel)
   - The angle (how to present this: personal story, tips, controversy, case study)
   
   Examples of good post ideas:
   - "I read [Book] and here are 5 frameworks that changed my business..."
   - "The #1 lesson from [Book] that most people miss..."
   - "Why [Author]'s advice on X is wrong (and what to do instead)..."

4. Be SPECIFIC and ACTIONABLE:
   - Don't give generic advice
   - Include specific numbers, names, concepts
   - Make insights shareable and engaging`

        return prompt
    }

    private getSystemPrompt(): string {
        return `You are an expert content analyst and strategist. Your task is to analyze content and extract SPECIFIC, ACTIONABLE insights.

                FOR VIDEO CONTENT (YouTube, etc.):
                - Identify the main argument/thesis of the video
                - Extract KEY TAKEAWAYS and actionable advice
                - Note any FRAMEWORKS, STRATEGIES, or STEP-BY-STEP methods mentioned
                - Identify memorable quotes or statements
                - Think: "What would someone tweet after watching this?"

                FOR ARTICLES/BLOG POSTS:
                - Extract the core argument and supporting points
                - Identify data, statistics, or research mentioned
                - Note unique perspectives or contrarian views

                FOR ALL CONTENT:
                - Generate POST IDEAS that are specific and ready-to-use
                - Each post idea should have a compelling hook
                - Think about different angles: educational, controversial, personal story, how-to

                IMPORTANT: Always respond in English only, regardless of the input content language.
                Be SPECIFIC - avoid generic insights like "provides valuable information".
            `
    }

    private getVisionSystemPrompt(): string {
        return `You are a world-class content strategist and book analyst with encyclopedic knowledge of business, self-help, psychology, and popular non-fiction books.

YOUR MISSION: Analyze images and generate SPECIFIC, ACTIONABLE content ideas.

FOR BOOK COVERS:
- You KNOW the content of most popular books - use that knowledge
- Extract the book's CORE IDEAS, not just surface-level themes
- Identify FRAMEWORKS, MODELS, and METHODOLOGIES from the book
- Generate post ideas that would make readers want to learn more

FOR OTHER IMAGES:
- Extract meaningful insights, not generic descriptions
- Think like a social media creator - what would go viral?

CRITICAL RULES:
1. Be SPECIFIC - use actual concepts, frameworks, quotes from the book
2. postIdeas must be READY-TO-USE hooks and angles
3. Each post idea should be different (educational, controversial, personal story, how-to)
4. If it's a book you recognize, leverage your knowledge of its actual content
5. Always respond in English only.`
    }

    private getExtractionJsonSchema() {
        return {
            name: 'content_extraction',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    summary: {
                        type: 'string',
                        description: 'A 2-3 sentence summary of the content',
                    },
                    keyTopics: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of 3-7 main topics',
                    },
                    contentFormat: {
                        type: 'string',
                        enum: [
                            'video',
                            'article',
                            'thread',
                            'carousel',
                            'image',
                            'infographic',
                            'story',
                            'book',
                            'other',
                        ],
                        description: 'Format of the content',
                    },
                    tone: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of 2-4 tone attributes (e.g., professional, casual, humorous)',
                    },
                    targetAudience: {
                        type: 'string',
                        description: 'Description of the target audience',
                    },
                    keyInsights: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of 3-5 key takeaways',
                    },
                    postIdeas: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                idea: { type: 'string', description: 'The post idea or hook' },
                                format: {
                                    type: 'string',
                                    description: 'Suggested format: carousel, thread, video, story, reel',
                                },
                                angle: { type: 'string', description: 'Content angle or perspective' },
                            },
                            required: ['idea', 'format', 'angle'],
                            additionalProperties: false,
                        },
                        description: 'Array of 5-7 specific post ideas with hooks and angles',
                    },
                    contentStructure: {
                        type: 'string',
                        description: 'Description of content structure (hook, body, cta, etc)',
                    },
                    visualStyle: {
                        type: 'string',
                        description: 'Description of visual style if applicable',
                    },
                    suggestedTags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of 5-10 suggested tags for workspace',
                    },
                },
                required: [
                    'summary',
                    'keyTopics',
                    'contentFormat',
                    'tone',
                    'targetAudience',
                    'keyInsights',
                    'postIdeas',
                    'contentStructure',
                    'visualStyle',
                    'suggestedTags',
                ],
                additionalProperties: false,
            },
        }
    }

    private parseExtractionResponse(responseText: string): ExtractionData {
        const data = JSON.parse(responseText)

        if (!data.summary || !data.keyTopics || !data.contentFormat) {
            throw new Error('Invalid extraction response: missing required fields')
        }

        return {
            summary: data.summary,
            keyTopics: data.keyTopics,
            contentFormat: data.contentFormat,
            tone: data.tone,
            targetAudience: data.targetAudience,
            keyInsights: data.keyInsights,
            postIdeas: data.postIdeas ?? [],
            contentStructure: data.contentStructure,
            visualStyle: data.visualStyle || null,
            suggestedTags: data.suggestedTags,
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
