import OpenAI from 'openai'
import youtubedl from 'youtube-dl-exec'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

import type { ILogger } from '@/shared/logger/logger.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import { getEnvVar } from '@/shared/utils/get-env-var'

/**
 * Result of audio download
 */
export interface DownloadAudioResult {
    /** Path to the downloaded audio file */
    filePath: string

    /** Size in bytes */
    sizeBytes: number

    /** Duration in seconds (if known) */
    durationSec?: number

    /** Audio format */
    format: string
}

/**
 * Result of audio transcription
 */
export interface TranscribeAudioResult {
    /** Transcribed text */
    text: string

    /** Detected or specified language */
    language: string

    /** Duration of audio in seconds */
    durationSec?: number

    /** Segments with timing (if available) */
    segments?: Array<{
        startSec: number
        endSec: number
        text: string
    }>
}

/**
 * Options for transcription
 */
export interface TranscribeOptions {
    /** Preferred language code (e.g., 'en', 'ru') */
    language?: string

    /** Whether to return segments with timestamps */
    includeTimestamps?: boolean
}

/**
 * Service for Speech-to-Text transcription using OpenAI Whisper API
 */
export interface ISTTService {
    /**
     * Download audio from YouTube video
     */
    downloadAudio(videoId: string): Promise<DownloadAudioResult>

    /**
     * Transcribe audio file using OpenAI Whisper
     */
    transcribeAudio(audioPath: string, options?: TranscribeOptions): Promise<TranscribeAudioResult>

    /**
     * Download and transcribe YouTube video (convenience method)
     */
    transcribeVideo(videoId: string, options?: TranscribeOptions): Promise<TranscribeAudioResult>

    /**
     * Clean up temporary audio file
     */
    cleanupAudio(filePath: string): Promise<void>
}

export class STTService implements ISTTService {
    private readonly openai: OpenAI
    private readonly tempDir: string
    private readonly maxFileSizeBytes = 25 * 1024 * 1024 // 25 MB Whisper limit

    constructor(private readonly logger: ILogger) {
        const apiKey = getEnvVar('OPENAI_API_KEY')

        this.openai = new OpenAI({ apiKey })
        this.tempDir = path.join(os.tmpdir(), 'zapshipr-audio')
    }

    async downloadAudio(videoId: string): Promise<DownloadAudioResult> {
        this.logger.info('Downloading audio from YouTube', {
            operation: 'STTService.downloadAudio',
            videoId,
        })

        // Ensure temp directory exists
        await fsPromises.mkdir(this.tempDir, { recursive: true })

        const outputPath = path.join(this.tempDir, `${videoId}_${Date.now()}`)
        const url = `https://www.youtube.com/watch?v=${videoId}`

        try {
            // Download audio only, best quality under 25MB
            await youtubedl(url, {
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: 5, // Lower quality = smaller file (0=best, 9=worst)
                output: `${outputPath}.%(ext)s`,
                noCheckCertificates: true,
                noWarnings: true,
                // Limit to ~20 minutes to stay under 25MB with mp3 at quality 5
                // Average bitrate ~128kbps = ~1MB per minute
                // matchFilter: 'duration < 1500',
            })

            // Find the downloaded file
            const files = await fsPromises.readdir(this.tempDir)
            const audioFile = files.find(
                (f) => f.startsWith(`${videoId}_`) && (f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.webm'))
            )

            if (!audioFile) {
                throw new Error('Audio file not found after download')
            }

            const filePath = path.join(this.tempDir, audioFile)
            const stats = await fsPromises.stat(filePath)

            // Check file size
            if (stats.size > this.maxFileSizeBytes) {
                await this.cleanupAudio(filePath)
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                    message: `Audio file too large for Whisper API (${Math.round(stats.size / 1024 / 1024)}MB > 25MB limit)`,
                    httpCode: 400,
                })
            }

            const format = path.extname(audioFile).slice(1)

            this.logger.info('Audio downloaded successfully', {
                operation: 'STTService.downloadAudio',
                videoId,
                filePath,
                sizeBytes: stats.size,
                sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100,
                format,
            })

            return {
                filePath,
                sizeBytes: stats.size,
                format,
            }
        } catch (error) {
            if (error instanceof AppError) throw error

            const errorMessage = error instanceof Error ? error.message : String(error)

            this.logger.error('Failed to download audio', {
                operation: 'STTService.downloadAudio',
                videoId,
                error: errorMessage,
            })

            throw new AppError({
                errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
                message: `Failed to download audio: ${errorMessage}`,
                httpCode: 500,
            })
        }
    }

    async transcribeAudio(audioPath: string, options: TranscribeOptions = {}): Promise<TranscribeAudioResult> {
        const { language, includeTimestamps = true } = options

        this.logger.info('Transcribing audio with Whisper', {
            operation: 'STTService.transcribeAudio',
            audioPath,
            language,
            includeTimestamps,
        })

        try {
            // Check file exists and size
            const stats = await fsPromises.stat(audioPath)
            if (stats.size > this.maxFileSizeBytes) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                    message: `Audio file too large (${Math.round(stats.size / 1024 / 1024)}MB > 25MB limit)`,
                    httpCode: 400,
                })
            }

            const fileStream = fs.createReadStream(audioPath)

            // Use verbose_json to get segments with timestamps
            const response = await this.openai.audio.transcriptions.create({
                file: fileStream,
                model: 'whisper-1',
                language: language || undefined,
                response_format: includeTimestamps ? 'verbose_json' : 'json',
            })

            // Parse response based on format
            let text: string
            let detectedLanguage: string
            let segments: TranscribeAudioResult['segments']
            let durationSec: number | undefined

            if (includeTimestamps && typeof response === 'object' && 'segments' in response) {
                const verboseResponse = response as {
                    text: string
                    language: string
                    duration?: number
                    segments?: Array<{ start: number; end: number; text: string }>
                }

                text = verboseResponse.text
                detectedLanguage = verboseResponse.language || language || 'en'
                durationSec = verboseResponse.duration

                if (verboseResponse.segments) {
                    segments = verboseResponse.segments.map((seg) => ({
                        startSec: seg.start,
                        endSec: seg.end,
                        text: seg.text.trim(),
                    }))
                }
            } else {
                text = typeof response === 'string' ? response : response.text
                detectedLanguage = language || 'en'
            }

            this.logger.info('Audio transcribed successfully', {
                operation: 'STTService.transcribeAudio',
                audioPath,
                language: detectedLanguage,
                textLength: text.length,
                segmentsCount: segments?.length || 0,
                durationSec,
            })

            return {
                text,
                language: detectedLanguage,
                durationSec,
                segments,
            }
        } catch (error) {
            if (error instanceof AppError) throw error

            const errorMessage = error instanceof Error ? error.message : String(error)

            this.logger.error('Failed to transcribe audio', {
                operation: 'STTService.transcribeAudio',
                audioPath,
                error: errorMessage,
            })

            throw new AppError({
                errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
                message: `Failed to transcribe audio: ${errorMessage}`,
                httpCode: 500,
            })
        }
    }

    async transcribeVideo(videoId: string, options: TranscribeOptions = {}): Promise<TranscribeAudioResult> {
        this.logger.info('Starting video transcription pipeline', {
            operation: 'STTService.transcribeVideo',
            videoId,
            options,
        })

        let audioPath: string | null = null

        try {
            // Step 1: Download audio
            const downloadResult = await this.downloadAudio(videoId)
            audioPath = downloadResult.filePath

            // Step 2: Transcribe
            const transcribeResult = await this.transcribeAudio(audioPath, options)

            // Step 3: Cleanup
            await this.cleanupAudio(audioPath)
            audioPath = null

            this.logger.info('Video transcription completed', {
                operation: 'STTService.transcribeVideo',
                videoId,
                language: transcribeResult.language,
                textLength: transcribeResult.text.length,
            })

            return transcribeResult
        } catch (error) {
            // Cleanup on error
            if (audioPath) {
                await this.cleanupAudio(audioPath).catch(() => {})
            }
            throw error
        }
    }

    async cleanupAudio(filePath: string): Promise<void> {
        try {
            await fsPromises.unlink(filePath)
            this.logger.debug('Cleaned up audio file', {
                operation: 'STTService.cleanupAudio',
                filePath,
            })
        } catch (error) {
            // Ignore if file doesn't exist
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.logger.warn('Failed to cleanup audio file', {
                    operation: 'STTService.cleanupAudio',
                    filePath,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
        }
    }
}

