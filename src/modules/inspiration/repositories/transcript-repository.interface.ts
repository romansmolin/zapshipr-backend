import type { Transcript, InsertTranscript } from '../entity/transcript.schema'

export interface ITranscriptRepository {
    /**
     * Create a new transcript
     */
    create(data: InsertTranscript): Promise<Transcript>

    /**
     * Find transcript by ID
     */
    findById(id: string): Promise<Transcript | undefined>

    /**
     * Find transcript by inspiration ID
     */
    findByInspirationId(inspirationId: string): Promise<Transcript | undefined>

    /**
     * Find transcript by video ID and language (for caching/deduplication)
     * Returns the most recent transcript for the given video and language
     */
    findByVideoIdAndLanguage(videoId: string, language: string): Promise<Transcript | undefined>

    /**
     * Find transcript by video ID only (any language)
     * Useful when language is not specified
     */
    findByVideoId(videoId: string): Promise<Transcript | undefined>

    /**
     * Update transcript
     */
    update(id: string, data: Partial<InsertTranscript>): Promise<Transcript | undefined>

    /**
     * Delete transcript by ID
     */
    delete(id: string): Promise<boolean>

    /**
     * Delete transcript by inspiration ID
     */
    deleteByInspirationId(inspirationId: string): Promise<boolean>
}

