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
                                    'visualStyle',
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
            contentStructure: data.contentStructure,
            visualStyle: data.visualStyle || null,
            suggestedTags: data.suggestedTags,
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
