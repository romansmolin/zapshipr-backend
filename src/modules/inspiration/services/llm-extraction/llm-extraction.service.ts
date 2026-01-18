import OpenAI from 'openai'
import type { ILogger } from '@/shared/logger/logger.interface'
import type {
    ILLMExtractionService,
    ExtractionInput,
    ExtractionResult,
    ExtractionData,
} from './llm-extraction-service.interface'
import {
    buildExtractionPrompt,
    buildVisionExtractionPrompt,
    getExtractionJsonSchema,
    getExtractionSystemPrompt,
    getVisionExtractionSystemPrompt,
} from './prompts/extraction-prompts'
import {
    buildDocumentMapPrompt,
    getDocumentMapJsonSchema,
    getDocumentMapSystemPrompt,
    DocumentChunkNotes,
} from './prompts/document-map-prompt'
import { buildDocumentReducePrompt, getDocumentReduceSystemPrompt } from './prompts/document-reduce-prompt'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { getEnvVar } from '@/shared/utils/get-env-var'
import { chunkText, estimateTokenCount, TranscriptChunk } from '../../utils/transcript-chunker'

export class LLMExtractionService implements ILLMExtractionService {
    private readonly openai: OpenAI
    private readonly model: string = 'gpt-4o'
    private readonly maxRetries = 3
    private readonly longFormTokenThreshold = 6000
    private readonly maxChunkTokens = 2600
    private readonly maxConcurrentChunks = 3
    private mapTokenCounts: Record<number, number> = {}

    constructor(private readonly logger: ILogger) {
        const apiKey = getEnvVar('OPENAI_API_KEY')

        this.openai = new OpenAI({
            apiKey,
        })
    }

    async createExtraction(input: ExtractionInput): Promise<ExtractionResult> {
        if (input.imageUrl) return this.createExtractionWithVision(input)

        if (this.shouldUseChunkedExtraction(input)) {
            return this.createDocumentExtractionWithMapReduce(input)
        }

        return this.createTextExtraction(input)
    }

    buildPromptForExtraction(input: ExtractionInput): string {
        return buildExtractionPrompt(input)
    }

    private async createTextExtraction(input: ExtractionInput): Promise<ExtractionResult> {
        const prompt = buildExtractionPrompt(input)

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
                            content: getExtractionSystemPrompt(),
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 2200,
                    response_format: {
                        type: 'json_schema',
                        json_schema: getExtractionJsonSchema(),
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
                        content: getVisionExtractionSystemPrompt(),
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
                                text: buildVisionExtractionPrompt(input),
                            },
                        ],
                    },
                ]

                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages,
                    temperature: 0.7,
                    max_tokens: 2500,
                    response_format: {
                        type: 'json_schema',
                        json_schema: getExtractionJsonSchema(),
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

    private parseExtractionResponse(responseText: string): ExtractionData {
        const data = JSON.parse(responseText)

        if (!data.summary || !data.keyTopics || !data.contentFormat || !data.structuredInsights) {
            throw new Error('Invalid extraction response: missing required fields')
        }

        return {
            summary: data.summary,
            keyTopics: data.keyTopics,
            contentFormat: data.contentFormat,
            tone: data.tone ?? [],
            targetAudience: data.targetAudience,
            keyInsights: data.keyInsights,
            postIdeas: data.postIdeas ?? [],
            contentStructure: data.contentStructure,
            visualStyle: data.visualStyle || null,
            suggestedTags: data.suggestedTags,
            structuredInsights: data.structuredInsights,
        }
    }

    private shouldUseChunkedExtraction(input: ExtractionInput): boolean {
        if (input.type !== 'document' || !input.content) return false
        return estimateTokenCount(input.content) > this.longFormTokenThreshold
    }

    private async createDocumentExtractionWithMapReduce(input: ExtractionInput): Promise<ExtractionResult> {
        const chunkResult = chunkText(input.content, {
            maxTokens: this.maxChunkTokens,
            minTokens: 600,
            overlapTokens: 150,
        })

        if (!chunkResult.wasChunked) {
            return this.createTextExtraction(input)
        }

        this.logger.info('Using chunked document extraction', {
            operation: 'LLMExtractionService.createDocumentExtractionWithMapReduce',
            totalChunks: chunkResult.chunks.length,
            tokenEstimate: chunkResult.totalTokens,
        })

        const chunkNotes = await this.mapDocumentChunks(chunkResult.chunks)
        const mapTokensUsed = Object.values(this.mapTokenCounts).reduce((sum, value) => sum + value, 0)
        const { extraction, tokensUsed: reduceTokensUsed } = await this.reduceDocumentNotes(chunkNotes, input)

        return {
            extraction,
            llmModel: this.model,
            tokensUsed: mapTokensUsed + reduceTokensUsed,
        }
    }

    private async mapDocumentChunks(chunks: TranscriptChunk[]): Promise<DocumentChunkNotes[]> {
        this.mapTokenCounts = {}
        const results: DocumentChunkNotes[] = []

        for (let i = 0; i < chunks.length; i += this.maxConcurrentChunks) {
            const batch = chunks.slice(i, i + this.maxConcurrentChunks)
            const batchResults = await Promise.all(
                batch.map((chunk) => this.processDocumentChunk(chunk, chunks.length))
            )
            results.push(...batchResults)
        }

        return results
    }

    private async processDocumentChunk(chunk: TranscriptChunk, totalChunks: number): Promise<DocumentChunkNotes> {
        const prompt = buildDocumentMapPrompt(chunk.text, chunk.index, totalChunks)
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        { role: 'system', content: getDocumentMapSystemPrompt() },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.4,
                    max_tokens: 1200,
                    response_format: {
                        type: 'json_schema',
                        json_schema: getDocumentMapJsonSchema(),
                    },
                })

                const responseText = completion.choices[0]?.message?.content
                if (!responseText) {
                    throw new Error('Empty response from OpenAI map phase')
                }

                const parsed = JSON.parse(responseText)
                const tokensUsed = completion.usage?.total_tokens || 0
                this.mapTokenCounts[chunk.index] = tokensUsed

                return {
                    chunkIndex: chunk.index,
                    coreIdeas: parsed.coreIdeas || [],
                    keyInsights: parsed.keyInsights || [],
                    mentalModels: parsed.mentalModels || [],
                    themes: parsed.themes || [],
                    narrativeNotes: parsed.narrativeNotes || [],
                    authorIntentHints: parsed.authorIntentHints || [],
                    toneHints: parsed.toneHints || [],
                }
            } catch (error) {
                lastError = error as Error
                this.logger.warn('Document chunk map failed', {
                    operation: 'LLMExtractionService.processDocumentChunk',
                    chunkIndex: chunk.index,
                    attempt,
                    error: lastError.message,
                })

                if (attempt < this.maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 1000)
                }
            }
        }

        throw new AppError({
            errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
            message: `Failed to process document chunk ${chunk.index + 1}: ${lastError?.message}`,
            httpCode: 500,
        })
    }

    private async reduceDocumentNotes(
        chunkNotes: DocumentChunkNotes[],
        input: ExtractionInput
    ): Promise<{ extraction: ExtractionData; tokensUsed: number }> {
        const prompt = buildDocumentReducePrompt(chunkNotes, {
            title: input.metadata?.title,
            author: input.metadata?.author,
            userDescription: input.userDescription,
            domain: input.metadata?.domain,
        })

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        { role: 'system', content: getDocumentReduceSystemPrompt() },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.5,
                    max_tokens: 2400,
                    response_format: {
                        type: 'json_schema',
                        json_schema: getExtractionJsonSchema(),
                    },
                })

                const responseText = completion.choices[0]?.message?.content
                if (!responseText) {
                    throw new Error('Empty response from OpenAI reduce phase')
                }

                const extraction = this.parseExtractionResponse(responseText)
                const tokensUsed = completion.usage?.total_tokens || 0

                return { extraction, tokensUsed }
            } catch (error) {
                lastError = error as Error
                this.logger.warn('Document reduce failed', {
                    operation: 'LLMExtractionService.reduceDocumentNotes',
                    attempt,
                    error: lastError.message,
                })

                if (attempt < this.maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 1000)
                }
            }
        }

        throw new AppError({
            errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
            message: `Failed to reduce document notes: ${lastError?.message}`,
            httpCode: 500,
        })
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
