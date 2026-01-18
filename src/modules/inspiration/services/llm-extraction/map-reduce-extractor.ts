import OpenAI from 'openai'
import { ILogger } from '@/shared/logger/logger.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { getEnvVar } from '@/shared/utils/get-env-var'

import { TranscriptChunk } from '../../utils/transcript-chunker'
import { YouTubeExtractionData } from './schemas/youtube-extraction.schema'
import {
    ChunkNotes,
    getMapPhaseJsonSchema,
    getMapPhaseSystemPrompt,
    buildMapPhasePrompt,
} from './prompts/map-prompt'
import {
    getReducePhaseJsonSchema,
    getReducePhaseSystemPrompt,
    buildReducePhasePrompt,
} from './prompts/reduce-prompt'

export interface MapReduceResult {
    extraction: YouTubeExtractionData
    chunkNotes: ChunkNotes[]
    stats: {
        totalChunks: number
        mapTokensUsed: number
        reduceTokensUsed: number
        totalTokensUsed: number
        mapDurationMs: number
        reduceDurationMs: number
        totalDurationMs: number
    }
    llmModel: string
}

export interface MapReduceOptions {
    maxConcurrentChunks?: number
    metadata?: {
        title?: string
        channelTitle?: string
        duration?: string
    }
}

export interface IMapReduceExtractor {
    /**
     * Process transcript chunks using Map-Reduce strategy
     * - Map: Extract notes from each chunk in parallel
     * - Reduce: Combine all chunk notes into final extraction
     */
    extract(chunks: TranscriptChunk[], options?: MapReduceOptions): Promise<MapReduceResult>
}

export class MapReduceExtractor implements IMapReduceExtractor {
    private readonly openai: OpenAI
    private readonly model: string = 'gpt-4o'
    private readonly maxRetries = 3

    constructor(private readonly logger: ILogger) {
        const apiKey = getEnvVar('OPENAI_API_KEY')
        this.openai = new OpenAI({ apiKey })
    }

    async extract(chunks: TranscriptChunk[], options: MapReduceOptions = {}): Promise<MapReduceResult> {
        const startTime = Date.now()
        const { maxConcurrentChunks = 3, metadata } = options

        this.logger.info('Starting Map-Reduce extraction', {
            operation: 'MapReduceExtractor.extract',
            totalChunks: chunks.length,
            maxConcurrentChunks,
        })

        // === MAP PHASE ===
        const mapStartTime = Date.now()
        const chunkNotes = await this.mapPhase(chunks, maxConcurrentChunks)
        const mapDurationMs = Date.now() - mapStartTime
        const mapTokensUsed = chunkNotes.reduce((sum, _, idx) => sum + (this.mapTokenCounts[idx] || 0), 0)

        this.logger.info('Map phase completed', {
            operation: 'MapReduceExtractor.extract',
            chunksProcessed: chunkNotes.length,
            mapTokensUsed,
            mapDurationMs,
        })

        // === REDUCE PHASE ===
        const reduceStartTime = Date.now()
        const { extraction, tokensUsed: reduceTokensUsed } = await this.reducePhase(chunkNotes, metadata)
        const reduceDurationMs = Date.now() - reduceStartTime

        const totalDurationMs = Date.now() - startTime
        const totalTokensUsed = mapTokensUsed + reduceTokensUsed

        this.logger.info('Map-Reduce extraction completed', {
            operation: 'MapReduceExtractor.extract',
            totalChunks: chunks.length,
            mapTokensUsed,
            reduceTokensUsed,
            totalTokensUsed,
            totalDurationMs,
        })

        return {
            extraction,
            chunkNotes,
            stats: {
                totalChunks: chunks.length,
                mapTokensUsed,
                reduceTokensUsed,
                totalTokensUsed,
                mapDurationMs,
                reduceDurationMs,
                totalDurationMs,
            },
            llmModel: this.model,
        }
    }

    // Store token counts per chunk for stats
    private mapTokenCounts: Record<number, number> = {}

    /**
     * Map Phase: Process chunks in parallel batches
     */
    private async mapPhase(chunks: TranscriptChunk[], maxConcurrent: number): Promise<ChunkNotes[]> {
        this.mapTokenCounts = {}
        const results: ChunkNotes[] = []

        // Process in batches
        for (let i = 0; i < chunks.length; i += maxConcurrent) {
            const batch = chunks.slice(i, i + maxConcurrent)

            const batchResults = await Promise.all(
                batch.map((chunk) => this.processChunk(chunk, chunks.length))
            )

            results.push(...batchResults)
        }

        return results
    }

    /**
     * Process a single chunk
     */
    private async processChunk(chunk: TranscriptChunk, totalChunks: number): Promise<ChunkNotes> {
        const prompt = buildMapPhasePrompt(
            chunk.text,
            chunk.index,
            totalChunks,
            chunk.startSec,
            chunk.endSec
        )

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        { role: 'system', content: getMapPhaseSystemPrompt() },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.5,
                    max_tokens: 1000,
                    response_format: {
                        type: 'json_schema',
                        json_schema: getMapPhaseJsonSchema(),
                    },
                })

                const responseText = completion.choices[0]?.message?.content
                if (!responseText) {
                    throw new Error('Empty response from OpenAI')
                }

                const parsed = JSON.parse(responseText)
                const tokensUsed = completion.usage?.total_tokens || 0
                this.mapTokenCounts[chunk.index] = tokensUsed

                return {
                    chunkIndex: chunk.index,
                    keyPoints: parsed.keyPoints || [],
                    quotes: parsed.quotes || [],
                    topics: parsed.topics || [],
                    hooks: parsed.hooks || [],
                }
            } catch (error) {
                lastError = error as Error
                this.logger.warn('Map phase chunk failed', {
                    operation: 'MapReduceExtractor.processChunk',
                    chunkIndex: chunk.index,
                    attempt,
                    error: lastError.message,
                })

                if (attempt < this.maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 1000)
                }
            }
        }

        // Return empty notes on failure (graceful degradation)
        this.logger.error('Map phase chunk failed after retries', {
            operation: 'MapReduceExtractor.processChunk',
            chunkIndex: chunk.index,
            error: lastError?.message,
        })

        return {
            chunkIndex: chunk.index,
            keyPoints: [],
            quotes: [],
            topics: [],
            hooks: [],
        }
    }

    /**
     * Reduce Phase: Combine all chunk notes into final extraction
     */
    private async reducePhase(
        chunkNotes: ChunkNotes[],
        metadata?: MapReduceOptions['metadata']
    ): Promise<{ extraction: YouTubeExtractionData; tokensUsed: number }> {
        const prompt = buildReducePhasePrompt(chunkNotes, {
            ...metadata,
            totalChunks: chunkNotes.length,
        })

        let lastError: Error | null = null

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.logger.info('Reduce phase attempt', {
                    operation: 'MapReduceExtractor.reducePhase',
                    attempt,
                    totalChunkNotes: chunkNotes.length,
                })

                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        { role: 'system', content: getReducePhaseSystemPrompt() },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.7,
                    max_tokens: 4000,
                    response_format: {
                        type: 'json_schema',
                        json_schema: getReducePhaseJsonSchema(),
                    },
                })

                const responseText = completion.choices[0]?.message?.content
                if (!responseText) {
                    throw new Error('Empty response from OpenAI')
                }

                const extraction = this.parseReduceResponse(responseText)
                const tokensUsed = completion.usage?.total_tokens || 0

                return { extraction, tokensUsed }
            } catch (error) {
                lastError = error as Error
                this.logger.warn('Reduce phase failed', {
                    operation: 'MapReduceExtractor.reducePhase',
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
            message: `Map-Reduce reduce phase failed after ${this.maxRetries} attempts: ${lastError?.message}`,
            httpCode: 500,
        })
    }

    private parseReduceResponse(responseText: string): YouTubeExtractionData {
        const data = JSON.parse(responseText)

        // Validate required fields
        if (!data.summary || !data.keyPoints || !data.hooks) {
            throw new Error('Invalid reduce response: missing required fields')
        }

        return {
            titleGuess: data.titleGuess || '',
            language: data.language || 'en',
            summary: data.summary,
            keyPoints: data.keyPoints || [],
            hooks: data.hooks || [],
            quotes: (data.quotes || []).map((q: any) => ({
                text: q.text,
                startSec: q.startSec ?? null,
                endSec: q.endSec ?? null,
            })),
            contentAngles: (data.contentAngles || []).map((a: any) => ({
                angle: a.angle,
                whyItWorks: a.whyItWorks,
            })),
            drafts: {
                threads: data.drafts?.threads || [],
                x: data.drafts?.x || [],
                linkedin: data.drafts?.linkedin || [],
                instagramCaption: data.drafts?.instagramCaption || [],
            },
            tags: data.tags || [],
            tone: data.tone || 'informational',
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

