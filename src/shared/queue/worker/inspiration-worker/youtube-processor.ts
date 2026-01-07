import { ILogger } from '@/shared/logger/logger.interface'
import { IInspirationsRepository } from '@/modules/inspiration/repositories/inspirations-repository.interface'
import { ITranscriptRepository } from '@/modules/inspiration/repositories/transcript-repository.interface'
import { ITranscriptProviderService, TranscriptProviderErrorCode } from '@/modules/inspiration/services/transcript-provider'
import { ISTTService } from '@/modules/inspiration/services/transcript-provider/stt.service'
import { ITranscriptNormalizerService } from '@/modules/inspiration/services/transcript-normalizer/transcript-normalizer-service.interface'
import { CanonicalVideoRef } from '@/modules/inspiration/types/youtube.types'
import { normalizeYouTubeUrl, isYouTubeUrl } from '@/modules/inspiration/utils/youtube-url-normalizer'
import { chunkTranscript, needsChunking, estimateTokenCount } from '@/modules/inspiration/utils/transcript-chunker'
import { MapReduceExtractor, MapReduceResult } from '@/modules/inspiration/services/llm-extraction/map-reduce-extractor'
import { QualityGate, QualityIssue, DEFAULT_QUALITY_RULES, RETRY_QUALITY_RULES } from '@/modules/inspiration/services/llm-extraction/quality-gate'
import {
    YouTubeExtractionData,
    getYouTubeExtractionJsonSchema,
    getYouTubeExtractionSystemPrompt,
    buildYouTubeExtractionPrompt,
} from '@/modules/inspiration/services/llm-extraction/schemas/youtube-extraction.schema'
import { buildRetryPrompt, getRetrySystemPrompt } from '@/modules/inspiration/services/llm-extraction/prompts/retry-prompt'
import OpenAI from 'openai'
import { getEnvVar } from '@/shared/utils/get-env-var'

export interface YouTubeProcessingResult {
    extraction: YouTubeExtractionData
    transcriptId: string
    stats: {
        transcriptSource: 'human_captions' | 'auto_captions' | 'stt'
        transcriptTokens: number
        wasChunked: boolean
        chunkCount: number
        totalTokensUsed: number
        qualityScore: number
        qualityRetried: boolean
        processingDurationMs: number
    }
}

export interface YouTubeProcessingError {
    code: YouTubeErrorCode
    message: string
    details?: Record<string, unknown>
}

export type YouTubeErrorCode =
    | 'NOT_YOUTUBE_URL'
    | 'INVALID_URL'
    | 'VIDEO_UNAVAILABLE'
    | 'VIDEO_PRIVATE'
    | 'VIDEO_AGE_RESTRICTED'
    | 'NO_TRANSCRIPT_AVAILABLE'
    | 'STT_FAILED'
    | 'EXTRACTION_FAILED'
    | 'QUALITY_CHECK_FAILED'
    | 'UNKNOWN_ERROR'

export class YouTubeProcessorError extends Error {
    code: YouTubeErrorCode
    details?: Record<string, unknown>

    constructor(code: YouTubeErrorCode, message: string, details?: Record<string, unknown>) {
        super(message)
        this.name = 'YouTubeProcessorError'
        this.code = code
        this.details = details
    }
}

export interface IYouTubeProcessor {
    /**
     * Check if URL is a YouTube URL
     */
    isYouTubeUrl(url: string): boolean

    /**
     * Process YouTube video: fetch transcript, extract ideas
     */
    process(
        inspirationId: string,
        url: string,
        metadata?: { title?: string; channelTitle?: string; duration?: string }
    ): Promise<YouTubeProcessingResult>
}

export class YouTubeProcessor implements IYouTubeProcessor {
    private readonly openai: OpenAI
    private readonly model = 'gpt-4o'
    private readonly maxTokensForSinglePass = 6000
    private readonly qualityGate: QualityGate

    constructor(
        private readonly logger: ILogger,
        private readonly inspirationsRepository: IInspirationsRepository,
        private readonly transcriptRepository: ITranscriptRepository,
        private readonly transcriptProvider: ITranscriptProviderService,
        private readonly sttService: ISTTService,
        private readonly transcriptNormalizer: ITranscriptNormalizerService,
        private readonly mapReduceExtractor: MapReduceExtractor
    ) {
        const apiKey = getEnvVar('OPENAI_API_KEY')
        this.openai = new OpenAI({ apiKey })
        this.qualityGate = new QualityGate()
    }

    isYouTubeUrl(url: string): boolean {
        return isYouTubeUrl(url)
    }

    async process(
        inspirationId: string,
        url: string,
        metadata?: { title?: string; channelTitle?: string; duration?: string }
    ): Promise<YouTubeProcessingResult> {
        const startTime = Date.now()

        this.logger.info('Starting YouTube processing', {
            operation: 'YouTubeProcessor.process',
            inspirationId,
            url: url.substring(0, 100),
        })

        // Step 1: Normalize URL
        const videoRef = this.normalizeUrl(url)

        // Step 2: Update status to transcript_fetching
        await this.updateStatus(inspirationId, 'transcript_fetching')

        // Step 3: Fetch transcript (captions or STT)
        const transcriptData = await this.fetchTranscript(inspirationId, videoRef)

        // Step 4: Update status to transcript_ready
        await this.updateStatus(inspirationId, 'transcript_ready')

        // Step 5: Normalize transcript
        // For json_segments format from STT, parse as JSON and use normalizeSegments
        let normalized
        if (transcriptData.format === 'json_segments') {
            const segments = JSON.parse(transcriptData.raw)
            const normalizedSegments = this.transcriptNormalizer.normalizeSegments(segments, { removeDuplicates: true })
            const normalizedText = normalizedSegments.map(s => s.text).join(' ')
            normalized = {
                normalizedText,
                segments: normalizedSegments,
                language: transcriptData.language || null,
                originalFormat: 'text' as const,
                stats: {
                    segmentCount: normalizedSegments.length,
                    totalDurationSec: normalizedSegments.length > 0 ? normalizedSegments[normalizedSegments.length - 1].endSec : 0,
                    characterCount: normalizedText.length,
                    wordCount: normalizedText.split(/\s+/).filter(w => w.length > 0).length,
                    duplicatesRemoved: 0,
                }
            }
        } else {
            normalized = this.transcriptNormalizer.parse(
                transcriptData.raw,
                { removeDuplicates: true }
            )
        }

        // Step 6: Save transcript to DB
        const transcript = await this.transcriptRepository.create({
            inspirationId,
            videoId: videoRef.videoId,
            language: normalized.language || transcriptData.language || 'en',
            source: transcriptData.source,
            format: transcriptData.format,
            raw: transcriptData.raw,
            normalizedText: normalized.normalizedText,
            segments: normalized.segments,
            durationSec: String(normalized.stats.totalDurationSec || transcriptData.durationSec || 0),
        })

        this.logger.info('Transcript saved', {
            operation: 'YouTubeProcessor.process',
            inspirationId,
            transcriptId: transcript.id,
            source: transcriptData.source,
            wordCount: normalized.stats.wordCount,
        })

        // Step 7: Update status to extracting
        await this.updateStatus(inspirationId, 'extracting')

        // Step 8: Extract (single pass or map-reduce)
        const tokenCount = estimateTokenCount(normalized.normalizedText)
        const needsMapReduce = needsChunking(normalized.normalizedText, this.maxTokensForSinglePass)

        let extraction: YouTubeExtractionData
        let totalTokensUsed: number
        let wasChunked = false
        let chunkCount = 1

        if (needsMapReduce) {
            this.logger.info('Using Map-Reduce for long transcript', {
                operation: 'YouTubeProcessor.process',
                inspirationId,
                tokenCount,
            })

            const chunks = chunkTranscript(normalized.segments, { maxTokens: 4000 })
            wasChunked = true
            chunkCount = chunks.chunks.length

            const result = await this.mapReduceExtractor.extract(chunks.chunks, { metadata })
            extraction = result.extraction
            totalTokensUsed = result.stats.totalTokensUsed
        } else {
            const result = await this.singlePassExtraction(
                normalized.normalizedText,
                metadata
            )
            extraction = result.extraction
            totalTokensUsed = result.tokensUsed
        }

        // Step 9: Quality Gate
        let qualityRetried = false
        let qualityResult = this.qualityGate.validate(extraction, DEFAULT_QUALITY_RULES)

        if (!qualityResult.passed) {
            this.logger.warn('Quality check failed, retrying', {
                operation: 'YouTubeProcessor.process',
                inspirationId,
                score: qualityResult.score,
                issues: qualityResult.issues.length,
            })

            qualityRetried = true
            const retryResult = await this.retryExtraction(
                normalized.normalizedText,
                metadata,
                qualityResult.issues,
                qualityResult.suggestions
            )

            extraction = retryResult.extraction
            totalTokensUsed += retryResult.tokensUsed

            qualityResult = this.qualityGate.validate(extraction, RETRY_QUALITY_RULES)

            if (!qualityResult.passed) {
                this.logger.warn('Quality check still failed after retry, proceeding anyway', {
                    operation: 'YouTubeProcessor.process',
                    inspirationId,
                    score: qualityResult.score,
                })
            }
        }

        const processingDurationMs = Date.now() - startTime

        this.logger.info('YouTube processing completed', {
            operation: 'YouTubeProcessor.process',
            inspirationId,
            transcriptSource: transcriptData.source,
            wasChunked,
            chunkCount,
            totalTokensUsed,
            qualityScore: qualityResult.score,
            qualityRetried,
            processingDurationMs,
        })

        return {
            extraction,
            transcriptId: transcript.id,
            stats: {
                transcriptSource: transcriptData.source,
                transcriptTokens: tokenCount,
                wasChunked,
                chunkCount,
                totalTokensUsed,
                qualityScore: qualityResult.score,
                qualityRetried,
                processingDurationMs,
            },
        }
    }

    private normalizeUrl(url: string): CanonicalVideoRef {
        const result = normalizeYouTubeUrl(url)

        if (!result.success) {
            const isNotYouTube = result.error.toLowerCase().includes('not a youtube')
            throw new YouTubeProcessorError(
                isNotYouTube ? 'NOT_YOUTUBE_URL' : 'INVALID_URL',
                result.error
            )
        }

        return result.ref
    }

    private async fetchTranscript(
        inspirationId: string,
        videoRef: CanonicalVideoRef
    ): Promise<{
        source: 'human_captions' | 'auto_captions' | 'stt'
        format: 'vtt' | 'srt' | 'text' | 'json_segments'
        raw: string
        language?: string
        durationSec?: number
    }> {
        // Try captions first
        try {
            const captions = await this.transcriptProvider.downloadCaptions(videoRef.videoId, {
                preferredLanguage: 'en',
                preferHuman: true,
            })

            return {
                source: captions.source === 'human_captions' ? 'human_captions' : 'auto_captions',
                format: captions.format,
                raw: captions.content,
                language: captions.language,
            }
        } catch (error: unknown) {
            // Check if it's a known transcript provider error
            const errorCode = this.extractErrorCode(error)

            if (errorCode) {
                this.logger.info('Captions not available, trying STT', {
                    operation: 'YouTubeProcessor.fetchTranscript',
                    inspirationId,
                    error: errorCode,
                })

                // Check if video is accessible for STT
                if (
                    errorCode === 'VIDEO_UNAVAILABLE' ||
                    errorCode === 'VIDEO_PRIVATE' ||
                    errorCode === 'VIDEO_AGE_RESTRICTED'
                ) {
                    throw new YouTubeProcessorError(
                        errorCode as YouTubeErrorCode,
                        `Video is ${errorCode.toLowerCase().replace('video_', '').replace('_', ' ')}`
                    )
                }
            }
        }

        // Fallback to STT
        try {
            const sttResult = await this.sttService.transcribeVideo(videoRef.videoId)

            return {
                source: 'stt',
                format: 'json_segments',
                raw: JSON.stringify(sttResult.segments || [{ startSec: 0, endSec: 0, text: sttResult.text }]),
                language: sttResult.language,
                durationSec: sttResult.durationSec,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'STT transcription failed'
            throw new YouTubeProcessorError('STT_FAILED', message)
        }
    }

    private extractErrorCode(error: unknown): TranscriptProviderErrorCode | null {
        if (error && typeof error === 'object' && 'code' in error) {
            return (error as { code: TranscriptProviderErrorCode }).code
        }
        if (error instanceof Error) {
            // Try to extract code from message
            const codeMatch = error.message.match(/VIDEO_UNAVAILABLE|VIDEO_PRIVATE|VIDEO_AGE_RESTRICTED|NO_CAPTIONS_AVAILABLE/i)
            if (codeMatch) {
                return codeMatch[0].toUpperCase() as TranscriptProviderErrorCode
            }
        }
        return null
    }

    private async singlePassExtraction(
        transcriptText: string,
        metadata?: { title?: string; channelTitle?: string; duration?: string }
    ): Promise<{ extraction: YouTubeExtractionData; tokensUsed: number }> {
        const prompt = buildYouTubeExtractionPrompt(transcriptText, metadata)

        const completion = await this.openai.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: getYouTubeExtractionSystemPrompt() },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 4000,
            response_format: {
                type: 'json_schema',
                json_schema: getYouTubeExtractionJsonSchema(),
            },
        })

        const responseText = completion.choices[0]?.message?.content
        if (!responseText) {
            throw new YouTubeProcessorError('EXTRACTION_FAILED', 'Empty response from OpenAI')
        }

        const extraction = this.parseExtractionResponse(responseText)
        const tokensUsed = completion.usage?.total_tokens || 0

        return { extraction, tokensUsed }
    }

    private async retryExtraction(
        transcriptText: string,
        metadata: { title?: string; channelTitle?: string; duration?: string } | undefined,
        issues: QualityIssue[],
        suggestions: string[]
    ): Promise<{ extraction: YouTubeExtractionData; tokensUsed: number }> {
        const basePrompt = buildYouTubeExtractionPrompt(transcriptText, metadata)
        const retryPrompt = buildRetryPrompt(basePrompt, issues, suggestions)

        const completion = await this.openai.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: getRetrySystemPrompt() },
                { role: 'user', content: retryPrompt },
            ],
            temperature: 0.8, // Slightly higher for more creativity
            max_tokens: 4000,
            response_format: {
                type: 'json_schema',
                json_schema: getYouTubeExtractionJsonSchema(),
            },
        })

        const responseText = completion.choices[0]?.message?.content
        if (!responseText) {
            throw new YouTubeProcessorError('EXTRACTION_FAILED', 'Empty response from OpenAI on retry')
        }

        const extraction = this.parseExtractionResponse(responseText)
        const tokensUsed = completion.usage?.total_tokens || 0

        return { extraction, tokensUsed }
    }

    private parseExtractionResponse(responseText: string): YouTubeExtractionData {
        const data = JSON.parse(responseText)

        return {
            titleGuess: data.titleGuess || '',
            language: data.language || 'en',
            summary: data.summary || '',
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

    private async updateStatus(
        inspirationId: string,
        status: 'transcript_fetching' | 'transcript_ready' | 'extracting'
    ): Promise<void> {
        await this.inspirationsRepository.update(inspirationId, { status })
    }
}
