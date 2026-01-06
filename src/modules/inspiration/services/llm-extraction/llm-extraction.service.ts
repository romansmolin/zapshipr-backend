import OpenAI from 'openai'
import type { ILogger } from '@/shared/logger/logger.interface'
import type {
    ILLMExtractionService,
    ExtractionInput,
    ExtractionResult,
    ExtractionData,
    BookExtractionInput,
    BookExtractionResult,
} from './llm-extraction-service.interface'
import type { BookExtractionData } from '../../entity/book-extraction.schema'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { getEnvVar } from '@/shared/utils/get-env-var'

export class LLMExtractionService implements ILLMExtractionService {
    private readonly openai: OpenAI
    private readonly model: string = 'gpt-4o' // или gpt-4o для более качественных результатов
    private readonly maxRetries = 3

    constructor(private readonly logger: ILogger) {
        const apiKey = getEnvVar('OPENAI_API_KEY')

        this.openai = new OpenAI({
            apiKey,
        })
    }

    async createExtraction(input: ExtractionInput): Promise<ExtractionResult> {
        const prompt = this.buildPromptForExtraction(input)

        let lastError: Error | null = null

        // Retry logic
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
                            content: `You are an expert content analyst. Your task is to analyze content and extract structured insights.
Extract key topics, tone, target audience, and actionable insights from the provided content.

IMPORTANT: Always respond in English only, regardless of the input content language.
If the content is in another language, translate and analyze it, but provide all output in English.`,
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
                        json_schema: {
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
                                            'other',
                                        ],
                                        description: 'Format of the content',
                                    },
                                    tone: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description:
                                            'Array of 2-4 tone attributes (e.g., professional, casual, humorous)',
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
                                    'contentStructure',
                                    'suggestedTags',
                                ],
                                additionalProperties: false,
                            },
                        },
                    },
                })

                const responseText = completion.choices[0]?.message?.content

                if (!responseText) {
                    throw new Error('Empty response from OpenAI')
                }

                // Парсим JSON ответ
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

                // Если это последняя попытка, пробрасываем ошибку
                if (attempt === this.maxRetries) {
                    break
                }

                // Экспоненциальная задержка перед следующей попыткой
                await this.delay(Math.pow(2, attempt) * 1000)
            }
        }

        // Если все попытки неудачны
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

        prompt += `Guidelines:
- Provide a clear 2-3 sentence summary
- Extract 3-7 key topics that represent main themes
- Identify 2-4 tone attributes (professional, casual, humorous, educational, inspirational, etc.)
- Provide 3-5 actionable key insights or takeaways
- Suggest 5-10 relevant tags that could categorize this content
- Describe the content structure (hook, body, call-to-action, etc.)
- If visual elements are present, describe the visual style
- Focus on insights that would help create similar content`

        return prompt
    }

    private parseExtractionResponse(responseText: string): ExtractionData {
        const data = JSON.parse(responseText)

        // OpenAI с JSON Schema гарантирует правильную структуру,
        // но добавим минимальную валидацию на всякий случай
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

    // === BOOK EXTRACTION METHODS ===

    async createBookExtraction(input: BookExtractionInput): Promise<BookExtractionResult> {
        const startTime = Date.now()
        const prompt = this.buildBookExtractionPrompt(input)

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.logger.info('Calling OpenAI API for book extraction', {
                    operation: 'LLMExtractionService.createBookExtraction',
                    attempt,
                    model: this.model,
                    bookTitle: input.bookMetadata.title,
                })

                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: this.getBookExtractionSystemPrompt(),
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.4, // Slightly lower for more consistent extraction
                    max_tokens: 4000, // Larger for comprehensive book analysis
                    response_format: { type: 'json_object' },
                })

                const responseText = completion.choices[0]?.message?.content

                if (!responseText) {
                    throw new Error('Empty response from OpenAI')
                }

                const extraction = this.parseBookExtractionResponse(responseText, input)
                const tokensUsed = completion.usage?.total_tokens || 0
                const processingDurationMs = Date.now() - startTime

                this.logger.info('Successfully created book extraction', {
                    operation: 'LLMExtractionService.createBookExtraction',
                    model: this.model,
                    tokensUsed,
                    processingDurationMs,
                    attempt,
                })

                return {
                    extraction,
                    llmModel: this.model,
                    tokensUsed,
                    processingDurationMs,
                }
            } catch (error) {
                lastError = error as Error
                this.logger.warn('Failed to create book extraction', {
                    operation: 'LLMExtractionService.createBookExtraction',
                    attempt,
                    error: lastError.message,
                })

                if (attempt === this.maxRetries) {
                    break
                }

                await this.delay(Math.pow(2, attempt) * 1000)
            }
        }

        this.logger.error('All retry attempts failed for book extraction', {
            operation: 'LLMExtractionService.createBookExtraction',
            error: lastError?.message,
        })

        throw new AppError({
            errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
            message: `Failed to create book extraction after ${this.maxRetries} attempts: ${lastError?.message}`,
            httpCode: 500,
        })
    }

    buildBookExtractionPrompt(input: BookExtractionInput): string {
        const { bookMetadata, parsedContent, userDescription } = input

        let prompt = `Analyze this book in depth and extract structured knowledge for content creation.\n\n`

        prompt += `=== BOOK INFORMATION ===\n`
        prompt += `Title: ${bookMetadata.title}\n`

        if (bookMetadata.authors?.length) {
            prompt += `Author(s): ${bookMetadata.authors.join(', ')}\n`
        }

        if (bookMetadata.categories?.length) {
            prompt += `Categories: ${bookMetadata.categories.join(', ')}\n`
        }

        if (bookMetadata.publishedDate) {
            prompt += `Published: ${bookMetadata.publishedDate}\n`
        }

        if (bookMetadata.description) {
            prompt += `\n=== OFFICIAL DESCRIPTION ===\n${bookMetadata.description}\n`
        }

        if (userDescription) {
            prompt += `\n=== USER'S NOTES ===\n${userDescription}\n`
        }

        if (parsedContent) {
            // Truncate if too long
            const maxContentLength = 8000
            const content =
                parsedContent.length > maxContentLength
                    ? parsedContent.substring(0, maxContentLength) + '\n[... content truncated ...]'
                    : parsedContent
            prompt += `\n=== ADDITIONAL CONTENT ===\n${content}\n`
        }

        prompt += `\n=== EXTRACTION TASK ===
Provide a comprehensive analysis including:

1. SEMANTIC CORE:
   - Core thesis (the ONE main idea in 1-2 sentences)
   - Author's philosophy/worldview
   - 5-7 key arguments or points
   - Frameworks/methodologies introduced (name, description, how to apply)
   - Memorable quotes or concepts

2. THEMES & PATTERNS:
   - Primary themes (3-5)
   - Secondary themes (2-4)
   - Narrative style
   - Tone (2-4 attributes)
   - Target reader profile
   - Problems the book solves

3. KNOWLEDGE CONNECTIONS:
   - Related/similar books
   - What ideas/works influenced this book
   - Opposing viewpoints or alternative approaches
   - Concepts this book builds upon

4. CONTENT GENERATION GUIDELINES:
   - 5-7 key insights reformulated for social media posts
     For each insight provide: the insight itself, a hook, content angle, suggested format
   - Suitable content formats (carousel, thread, video, etc.)
   - Potential CTAs
   - Relevant hashtags
   - Audience hooks (what will grab attention)

Return as a structured JSON matching the BookExtractionData schema.`

        return prompt
    }

    private getBookExtractionSystemPrompt(): string {
        return `You are an expert literary analyst, content strategist, and knowledge architect.

Your task is to deeply analyze books and extract machine-readable knowledge optimized for:
1. Understanding the book's core value and ideas
2. Creating engaging social media content based on the book
3. Building connections with other knowledge sources
4. Generating actionable insights for readers

IMPORTANT GUIDELINES:
- Focus on ACTIONABLE insights, not just summaries
- Identify FRAMEWORKS and MENTAL MODELS that can be applied
- Extract ideas that are SHAREABLE and ENGAGING for social media
- Think about what would make someone want to READ this book
- Consider multiple ANGLES for content creation
- Always respond in English, regardless of the book's language

Return a comprehensive JSON object following the BookExtractionData structure.`
    }

    private parseBookExtractionResponse(responseText: string, input: BookExtractionInput): BookExtractionData {
        const data = JSON.parse(responseText)

        // Build the extraction object with fallbacks for missing fields
        const extraction: BookExtractionData = {
            identification: {
                title: input.bookMetadata.title,
                authors: input.bookMetadata.authors || [],
                isbn: input.bookMetadata.isbn,
                isbn13: input.bookMetadata.isbn13,
                publicationYear: input.bookMetadata.publishedDate
                    ? parseInt(input.bookMetadata.publishedDate.substring(0, 4), 10) || undefined
                    : undefined,
                publisher: input.bookMetadata.publisher,
                genre: data.identification?.genre || input.bookMetadata.categories || [],
                category: data.identification?.category || this.inferCategory(input.bookMetadata.categories),
                language: input.bookMetadata.language,
                pageCount: input.bookMetadata.pageCount,
                confidence: input.bookMetadata.identificationConfidence || 0.5,
            },
            semanticCore: {
                coreThesis: data.semanticCore?.coreThesis || data.coreThesis || '',
                philosophy: data.semanticCore?.philosophy || data.philosophy || '',
                keyArguments: data.semanticCore?.keyArguments || data.keyArguments || [],
                frameworks: (data.semanticCore?.frameworks || data.frameworks || []).map(
                    (f: { name?: string; description?: string; application?: string }) => ({
                        name: f.name || '',
                        description: f.description || '',
                        application: f.application || '',
                    })
                ),
                memorableQuotes: data.semanticCore?.memorableQuotes || data.memorableQuotes || [],
            },
            themesAndPatterns: {
                primaryThemes: data.themesAndPatterns?.primaryThemes || data.primaryThemes || [],
                secondaryThemes: data.themesAndPatterns?.secondaryThemes || data.secondaryThemes || [],
                narrativeStyle: data.themesAndPatterns?.narrativeStyle || data.narrativeStyle || '',
                tone: data.themesAndPatterns?.tone || data.tone || [],
                targetReader: data.themesAndPatterns?.targetReader || data.targetReader || '',
                problemsSolved: data.themesAndPatterns?.problemsSolved || data.problemsSolved || [],
            },
            knowledgeConnections: {
                relatedBooks: data.knowledgeConnections?.relatedBooks || data.relatedBooks || [],
                influences: data.knowledgeConnections?.influences || data.influences || [],
                opposingViews: data.knowledgeConnections?.opposingViews || data.opposingViews || [],
                buildsUpon: data.knowledgeConnections?.buildsUpon || data.buildsUpon || [],
            },
            contentGenerationGuidelines: {
                keyInsightsForPosts: (
                    data.contentGenerationGuidelines?.keyInsightsForPosts ||
                    data.keyInsightsForPosts ||
                    []
                ).map(
                    (insight: {
                        insight?: string
                        hook?: string
                        contentAngle?: string
                        suggestedFormat?: string
                    }) => ({
                        insight: insight.insight || '',
                        hook: insight.hook || '',
                        contentAngle: insight.contentAngle || '',
                        suggestedFormat: insight.suggestedFormat || 'post',
                    })
                ),
                contentFormats: data.contentGenerationGuidelines?.contentFormats || data.contentFormats || [],
                callToActions: data.contentGenerationGuidelines?.callToActions || data.callToActions || [],
                hashtags: data.contentGenerationGuidelines?.hashtags || data.hashtags || [],
                audienceHooks: data.contentGenerationGuidelines?.audienceHooks || data.audienceHooks || [],
            },
            processingMeta: {
                llmModel: this.model,
                tokensUsed: 0, // Will be set by caller
                visionUsed: !!input.imageUrl,
                externalSourcesUsed: input.bookMetadata.dataSource ? [input.bookMetadata.dataSource] : [],
                processingDurationMs: 0, // Will be set by caller
            },
        }

        return extraction
    }

    private inferCategory(categories?: string[]): string {
        if (!categories || categories.length === 0) {
            return 'other'
        }

        const category = categories[0].toLowerCase()

        if (category.includes('business') || category.includes('management') || category.includes('economics')) {
            return 'business'
        }
        if (category.includes('self-help') || category.includes('personal development')) {
            return 'self-help'
        }
        if (category.includes('psychology')) {
            return 'psychology'
        }
        if (category.includes('fiction') || category.includes('novel')) {
            return 'fiction'
        }
        if (category.includes('biography')) {
            return 'biography'
        }
        if (category.includes('history')) {
            return 'history'
        }
        if (category.includes('science')) {
            return 'science'
        }
        if (category.includes('technology') || category.includes('computer')) {
            return 'technology'
        }
        if (category.includes('philosophy')) {
            return 'philosophy'
        }

        return 'other'
    }
}
