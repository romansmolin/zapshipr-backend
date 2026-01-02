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
    private readonly model: string = 'gpt-4o-mini' // или gpt-4o для более качественных результатов
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
                            content: `You are an expert content analyst. Your task is to analyze content and extract structured insights in JSON format.
Always respond with valid JSON only, no additional text or explanations.`,
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 1500,
                    response_format: { type: 'json_object' },
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

        prompt += `Extract the following information in JSON format:
{
  "summary": "A 2-3 sentence summary of the content",
  "keyTopics": ["array", "of", "main", "topics"],
  "contentFormat": "video | article | thread | carousel | image | infographic | story",
  "tone": ["professional", "casual", "humorous", "educational"],
  "targetAudience": "Description of the target audience",
  "keyInsights": ["Key", "takeaways", "from", "content"],
  "contentStructure": "Description of how the content is structured (hook, body, cta, etc)",
  "visualStyle": "Description of visual style if applicable",
  "suggestedTags": ["suggested", "tags", "for", "workspace"]
}

Guidelines:
- Be concise and specific
- Extract 3-7 key topics
- Identify 2-4 tone attributes
- Provide 3-5 key insights
- Suggest 5-10 relevant tags
- Focus on actionable insights`

        return prompt
    }

    private parseExtractionResponse(responseText: string): ExtractionData {
        const data = JSON.parse(responseText)

        // Валидация обязательных полей
        if (!data.summary || !data.keyTopics || !data.contentFormat || !data.tone) {
            throw new Error('Missing required fields in extraction response')
        }

        return {
            summary: data.summary,
            keyTopics: Array.isArray(data.keyTopics) ? data.keyTopics : [],
            contentFormat: data.contentFormat,
            tone: Array.isArray(data.tone) ? data.tone : [],
            targetAudience: data.targetAudience || '',
            keyInsights: Array.isArray(data.keyInsights) ? data.keyInsights : [],
            contentStructure: data.contentStructure || '',
            visualStyle: data.visualStyle,
            suggestedTags: Array.isArray(data.suggestedTags) ? data.suggestedTags : [],
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

