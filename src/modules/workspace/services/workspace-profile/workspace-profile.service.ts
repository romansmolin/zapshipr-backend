import type { ILogger } from '@/shared/logger'

import type { IWorkspaceRepository } from '../../repositories/workspace-repository.interface'
import type { IWorkspaceProfileSignalsRepository } from '../../repositories/workspace-profile-signals-repository.interface'
import type { IWorkspaceTagsService } from '@/modules/inspiration/services/workspace-tags/workspace-tags-service.interface'
import type {
    WorkspaceAIContext,
    ProfileSignalInput,
    LearnedPreferences,
    CompletionLevel,
} from '../../entity/workspace-profile.types'
import type { Onboarding } from '../../validation/onboarding.schemas'
import { calculateCompletionLevel } from '../../utils/onboarding-normalizer'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

export interface IWorkspaceProfileService {
    getNormalizedAIContext(workspaceId: string): Promise<WorkspaceAIContext>
    recordSignal(workspaceId: string, signal: ProfileSignalInput): Promise<void>
    getLearnedPreferences(workspaceId: string): Promise<LearnedPreferences>
    getCompletionLevel(workspaceId: string): Promise<CompletionLevel>
    getCompletionScore(workspaceId: string): Promise<number>
}

export class WorkspaceProfileService implements IWorkspaceProfileService {
    constructor(
        private workspaceRepository: IWorkspaceRepository,
        private signalsRepository: IWorkspaceProfileSignalsRepository,
        private tagsService: IWorkspaceTagsService,
        private logger: ILogger
    ) {}

    async getNormalizedAIContext(workspaceId: string): Promise<WorkspaceAIContext> {
        this.logger.info('Getting normalized AI context', { workspaceId })

        // Fetch workspace with onboarding data
        const workspace = await this.workspaceRepository.findById(workspaceId)
        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (!workspace.onboarding) {
            throw new BaseAppError(
                'Workspace onboarding not completed',
                ErrorCode.BAD_REQUEST,
                400
            )
        }

        const onboarding = workspace.onboarding as Onboarding

        // Fetch user-created tags
        const { tags: userTags } = await this.tagsService.getTags(workspaceId, {})

        // Group tags by category
        const tagsByCategory = {
            topics: userTags.filter((t) => t.category === 'topic').map((t) => t.name),
            formats: userTags.filter((t) => t.category === 'format').map((t) => t.name),
            tones: userTags.filter((t) => t.category === 'tone').map((t) => t.name),
            styles: userTags.filter((t) => t.category === 'style').map((t) => t.name),
            other: userTags.filter((t) => t.category === 'other').map((t) => t.name),
        }

        // Fetch learned preferences
        const learned = await this.getLearnedPreferences(workspaceId)

        // Calculate completion level and score
        const completionLevel =
            onboarding.meta.completionLevel ?? calculateCompletionLevel(onboarding)
        const completionScore = await this.getCompletionScore(workspaceId)

        // Build normalized context
        const context: WorkspaceAIContext = {
            workspaceId,
            goal: {
                primary: onboarding.goal.primaryGoal,
                outcome: onboarding.goal.expectedOutcome,
                signals: onboarding.goal.successSignals,
            },
            audience: {
                type: onboarding.audience.audienceType,
                awarenessLevel: onboarding.audience.awarenessLevel,
                painPoints: onboarding.audience.painOrDesire,
                languages: onboarding.audience.languages ?? [],
            },
            voice: {
                tones: onboarding.voice.tones,
                brandType: onboarding.voice.brandType,
                perspective: onboarding.voice.perspective,
                personalityAnchors: onboarding.voice.personalityAnchors,
            },
            contentStrategy: {
                topics: onboarding.contentStrategy.topics,
                pillars: onboarding.contentStrategy.pillars,
                formats: onboarding.contentStrategy.formats,
            },
            constraints: {
                platforms: onboarding.constraints.platforms,
                hardConstraints: onboarding.constraints.hardConstraints ?? [],
                forbiddenWords: [], // TODO: Extract from examples if needed
            },
            sales: {
                profile: onboarding.sales.profile,
                policy: onboarding.sales.policy,
            },
            tags: tagsByCategory,
            learned: {
                frequentTones: learned.frequentTones,
                frequentFormats: learned.frequentFormats,
                frequentTopics: learned.frequentTopics,
                preferredPlatforms: learned.preferredPlatforms,
                avgContentLength: learned.avgContentLength,
                confidence: learned.confidence,
            },
            meta: {
                version: onboarding.meta.version,
                completionLevel,
                completionScore,
                lastUpdated: onboarding.meta.updatedAt,
            },
        }

        return context
    }

    async recordSignal(workspaceId: string, signal: ProfileSignalInput): Promise<void> {
        this.logger.info('Recording workspace profile signal', {
            workspaceId,
            signalType: signal.type,
        })

        await this.signalsRepository.create({
            workspaceId,
            signalType: signal.type,
            signalSource: signal.source,
            signalData: signal.data,
            weight: (signal.weight ?? 1.0).toString(),
            isProcessed: false,
        })
    }

    async getLearnedPreferences(workspaceId: string): Promise<LearnedPreferences> {
        this.logger.info('Getting learned preferences', { workspaceId })

        const daysBack = 90

        // Aggregate signals by type
        const aggregated = await this.signalsRepository.aggregateByType(workspaceId, {
            daysBack,
            signalTypes: [
                'tone_used',
                'format_used',
                'tag_applied',
                'platform_used',
                'content_generated',
            ],
        })

        // Count total signals for confidence calculation
        const totalSignals = await this.signalsRepository.countByType(workspaceId, '', daysBack)

        // Extract top items by signal type
        const toneSignals = aggregated
            .filter((a) => a.signalType === 'tone_used')
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((a) => a.value)

        const formatSignals = aggregated
            .filter((a) => a.signalType === 'format_used')
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((a) => a.value)

        const topicSignals = aggregated
            .filter((a) => a.signalType === 'tag_applied')
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((a) => a.value)

        const platformSignals = aggregated
            .filter((a) => a.signalType === 'platform_used')
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((a) => a.value)

        // Calculate average content length from content_generated signals
        const contentSignals = await this.signalsRepository.findRecent(workspaceId, {
            daysBack,
            limit: 100,
            signalType: 'content_generated',
        })

        let avgContentLength: number | null = null
        if (contentSignals.length > 0) {
            const lengths = contentSignals
                .map((s) => (s.signalData as any)?.contentLength)
                .filter((l) => typeof l === 'number')

            if (lengths.length > 0) {
                avgContentLength =
                    Math.round(lengths.reduce((sum, l) => sum + l, 0) / lengths.length)
            }
        }

        // Calculate confidence (0.0-1.0) based on signal count
        // 0 signals = 0.0, 50+ signals = 1.0
        const confidence = Math.min(totalSignals / 50, 1.0)

        return {
            frequentTones: toneSignals,
            frequentFormats: formatSignals,
            frequentTopics: topicSignals,
            preferredPlatforms: platformSignals,
            avgContentLength,
            confidence: Math.round(confidence * 100) / 100,
            lastUpdated: new Date(),
        }
    }

    async getCompletionLevel(workspaceId: string): Promise<CompletionLevel> {
        this.logger.info('Getting completion level', { workspaceId })

        const workspace = await this.workspaceRepository.findById(workspaceId)
        if (!workspace || !workspace.onboarding) {
            return 'quick_start'
        }

        const onboarding = workspace.onboarding as Onboarding

        return onboarding.meta.completionLevel ?? calculateCompletionLevel(onboarding)
    }

    async getCompletionScore(workspaceId: string): Promise<number> {
        this.logger.info('Getting completion score', { workspaceId })

        const workspace = await this.workspaceRepository.findById(workspaceId)
        if (!workspace || !workspace.onboarding) {
            return 0.0
        }

        const onboarding = workspace.onboarding as Onboarding

        // Count filled fields
        let filledFields = 0
        const totalFields = 14

        // Required fields (always filled in valid onboarding)
        filledFields += 5 // primaryGoal, audienceType, tones, pillars, platforms

        // Optional deep fields
        if (onboarding.goal.expectedOutcome) filledFields++
        if (onboarding.goal.successSignals && onboarding.goal.successSignals.length > 0)
            filledFields++
        if (onboarding.audience.awarenessLevel) filledFields++
        if (onboarding.audience.painOrDesire) filledFields++
        if (onboarding.voice.brandType) filledFields++
        if (onboarding.voice.perspective) filledFields++
        if (onboarding.contentStrategy.topics && onboarding.contentStrategy.topics.length > 0)
            filledFields++
        if (onboarding.contentStrategy.formats && onboarding.contentStrategy.formats.length > 0)
            filledFields++
        if (onboarding.contentStrategy.postingFrequency) filledFields++

        const score = filledFields / totalFields

        return Math.round(score * 100) / 100
    }
}
