import { eq, and, desc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema } from '@/db/schema'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'

import { transcripts, type Transcript, type InsertTranscript } from '../entity/transcript.schema'
import type { ITranscriptRepository } from './transcript-repository.interface'

export class TranscriptRepository implements ITranscriptRepository {
    constructor(
        private readonly db: NodePgDatabase<typeof schema>,
        private readonly logger: ILogger
    ) {}

    async create(data: InsertTranscript): Promise<Transcript> {
        try {
            const [transcript] = await this.db
                .insert(transcripts)
                .values(data)
                .returning()

            this.logger.info('Created transcript', {
                operation: 'TranscriptRepository.create',
                entity: 'transcripts',
                transcriptId: transcript.id,
                inspirationId: transcript.inspirationId,
                videoId: transcript.videoId,
                source: transcript.source,
                language: transcript.language,
            })

            return transcript
        } catch (error) {
            this.logger.error('Failed to create transcript', {
                operation: 'TranscriptRepository.create',
                entity: 'transcripts',
                error: formatError(error),
            })
            throw error
        }
    }

    async findById(id: string): Promise<Transcript | undefined> {
        try {
            const [transcript] = await this.db
                .select()
                .from(transcripts)
                .where(eq(transcripts.id, id))
                .limit(1)

            return transcript
        } catch (error) {
            this.logger.error('Failed to find transcript by ID', {
                operation: 'TranscriptRepository.findById',
                entity: 'transcripts',
                transcriptId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async findByInspirationId(inspirationId: string): Promise<Transcript | undefined> {
        try {
            const [transcript] = await this.db
                .select()
                .from(transcripts)
                .where(eq(transcripts.inspirationId, inspirationId))
                .orderBy(desc(transcripts.createdAt))
                .limit(1)

            return transcript
        } catch (error) {
            this.logger.error('Failed to find transcript by inspiration ID', {
                operation: 'TranscriptRepository.findByInspirationId',
                entity: 'transcripts',
                inspirationId,
                error: formatError(error),
            })
            throw error
        }
    }

    async findByVideoIdAndLanguage(videoId: string, language: string): Promise<Transcript | undefined> {
        try {
            const [transcript] = await this.db
                .select()
                .from(transcripts)
                .where(
                    and(
                        eq(transcripts.videoId, videoId),
                        eq(transcripts.language, language)
                    )
                )
                .orderBy(desc(transcripts.createdAt))
                .limit(1)

            if (transcript) {
                this.logger.debug('Found cached transcript', {
                    operation: 'TranscriptRepository.findByVideoIdAndLanguage',
                    videoId,
                    language,
                    transcriptId: transcript.id,
                })
            }

            return transcript
        } catch (error) {
            this.logger.error('Failed to find transcript by video ID and language', {
                operation: 'TranscriptRepository.findByVideoIdAndLanguage',
                entity: 'transcripts',
                videoId,
                language,
                error: formatError(error),
            })
            throw error
        }
    }

    async findByVideoId(videoId: string): Promise<Transcript | undefined> {
        try {
            const [transcript] = await this.db
                .select()
                .from(transcripts)
                .where(eq(transcripts.videoId, videoId))
                .orderBy(desc(transcripts.createdAt))
                .limit(1)

            return transcript
        } catch (error) {
            this.logger.error('Failed to find transcript by video ID', {
                operation: 'TranscriptRepository.findByVideoId',
                entity: 'transcripts',
                videoId,
                error: formatError(error),
            })
            throw error
        }
    }

    async update(id: string, data: Partial<InsertTranscript>): Promise<Transcript | undefined> {
        try {
            const [transcript] = await this.db
                .update(transcripts)
                .set(data)
                .where(eq(transcripts.id, id))
                .returning()

            if (transcript) {
                this.logger.info('Updated transcript', {
                    operation: 'TranscriptRepository.update',
                    entity: 'transcripts',
                    transcriptId: id,
                })
            }

            return transcript
        } catch (error) {
            this.logger.error('Failed to update transcript', {
                operation: 'TranscriptRepository.update',
                entity: 'transcripts',
                transcriptId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const result = await this.db
                .delete(transcripts)
                .where(eq(transcripts.id, id))
                .returning()

            const deleted = result.length > 0

            if (deleted) {
                this.logger.info('Deleted transcript', {
                    operation: 'TranscriptRepository.delete',
                    entity: 'transcripts',
                    transcriptId: id,
                })
            }

            return deleted
        } catch (error) {
            this.logger.error('Failed to delete transcript', {
                operation: 'TranscriptRepository.delete',
                entity: 'transcripts',
                transcriptId: id,
                error: formatError(error),
            })
            throw error
        }
    }

    async deleteByInspirationId(inspirationId: string): Promise<boolean> {
        try {
            const result = await this.db
                .delete(transcripts)
                .where(eq(transcripts.inspirationId, inspirationId))
                .returning()

            const deleted = result.length > 0

            if (deleted) {
                this.logger.info('Deleted transcripts by inspiration ID', {
                    operation: 'TranscriptRepository.deleteByInspirationId',
                    entity: 'transcripts',
                    inspirationId,
                    count: result.length,
                })
            }

            return deleted
        } catch (error) {
            this.logger.error('Failed to delete transcripts by inspiration ID', {
                operation: 'TranscriptRepository.deleteByInspirationId',
                entity: 'transcripts',
                inspirationId,
                error: formatError(error),
            })
            throw error
        }
    }
}

