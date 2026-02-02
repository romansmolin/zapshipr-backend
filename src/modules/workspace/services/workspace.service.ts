import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import type { ILogger } from '@/shared/logger'

import { toWorkspaceDto, type WorkspaceDto } from '../entity/workspace.dto'
import type { IWorkspaceRepository } from '../repositories/workspace-repository.interface'
import type {
    CreateWorkspaceInput,
    UpdateWorkspaceInput,
    MainPrompt,
    UpdateMainPrompt,
} from '../validation/workspace.schemas'
import type { Onboarding, UpdateOnboardingInput } from '../validation/onboarding.schemas'
import type { IWorkspaceService } from './workspace-service.interface'
import { normalizeOnboarding, validateOnboardingInput } from '../utils/onboarding-normalizer'

export class WorkspaceService implements IWorkspaceService {
    constructor(
        private repository: IWorkspaceRepository,
        private logger: ILogger
    ) {}

    async create(userId: string, data: CreateWorkspaceInput): Promise<WorkspaceDto> {
        this.logger.info('Creating workspace', { userId, name: data.name })

        // Validate that client didn't send forbidden server-side fields
        validateOnboardingInput(data.onboarding)

        // Проверяем, есть ли у пользователя уже workspaces
        const workspacesCount = await this.repository.countByUserId(userId)
        const isFirstWorkspace = workspacesCount === 0

        // Create workspace first to get the ID
        const workspace = await this.repository.create({
            userId,
            name: data.name,
            description: data.description || null,
            isDefault: isFirstWorkspace, // Если это первый workspace - делаем его дефолтным
            onboarding: null, // Will be set in the next step
        })

        // Normalize onboarding with the workspace ID
        const normalizedOnboarding = normalizeOnboarding(data.onboarding, workspace.id)

        // Update workspace with normalized onboarding
        const updatedWorkspace = await this.repository.updateOnboarding(workspace.id, normalizedOnboarding)

        if (!updatedWorkspace) {
            throw new BaseAppError('Failed to set onboarding', ErrorCode.UNKNOWN_ERROR, 500)
        }

        this.logger.info('Workspace created', {
            workspaceId: updatedWorkspace.id,
            isDefault: updatedWorkspace.isDefault,
            isFirstWorkspace,
        })

        return toWorkspaceDto(updatedWorkspace)
    }

    async getById(id: string, userId: string): Promise<WorkspaceDto> {
        this.logger.info('Getting workspace by id', { workspaceId: id, userId })

        const workspace = await this.repository.findById(id)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        return toWorkspaceDto(workspace)
    }

    async getByUserId(userId: string): Promise<WorkspaceDto[]> {
        this.logger.info('Getting workspaces by user id', { userId })

        const workspaces = await this.repository.findByUserId(userId)

        return workspaces.map(toWorkspaceDto)
    }

    async update(id: string, userId: string, data: UpdateWorkspaceInput): Promise<WorkspaceDto> {
        this.logger.info('Updating workspace', { workspaceId: id, userId })

        const existingWorkspace = await this.repository.findById(id)

        if (!existingWorkspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (existingWorkspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        const workspace = await this.repository.update(id, {
            name: data.name,
            description: data.description,
        })

        if (!workspace) {
            throw new BaseAppError('Failed to update workspace', ErrorCode.UNKNOWN_ERROR, 500)
        }

        return toWorkspaceDto(workspace)
    }

    async delete(id: string, userId: string): Promise<void> {
        this.logger.info('Deleting workspace', { workspaceId: id, userId })

        const workspace = await this.repository.findById(id)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        await this.repository.delete(id)
    }

    async getMainPrompt(workspaceId: string, userId: string): Promise<MainPrompt> {
        this.logger.info('Getting main prompt', { workspaceId, userId })

        const workspace = await this.repository.findById(workspaceId)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        // Если main prompt не установлен, вернуть пустую структуру
        if (!workspace.mainPrompt) {
            return {
                brandVoice: '',
                coreThemes: [],
                targetAudience: '',
                contentGoals: [],
                avoidTopics: [],
                preferredFormats: [],
                additionalContext: '',
            }
        }

        return workspace.mainPrompt as MainPrompt
    }

    async updateMainPrompt(workspaceId: string, userId: string, data: UpdateMainPrompt): Promise<MainPrompt> {
        this.logger.info('Updating main prompt', { workspaceId, userId })

        const workspace = await this.repository.findById(workspaceId)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        // Merge с существующим prompt
        const currentPrompt = (workspace.mainPrompt as MainPrompt) || {
            brandVoice: '',
            coreThemes: [],
            targetAudience: '',
            contentGoals: [],
            avoidTopics: [],
            preferredFormats: [],
            additionalContext: '',
        }

        const updatedPrompt: MainPrompt = {
            brandVoice: data.brandVoice !== undefined ? data.brandVoice : currentPrompt.brandVoice || '',
            coreThemes: data.coreThemes !== undefined ? data.coreThemes : currentPrompt.coreThemes || [],
            targetAudience:
                data.targetAudience !== undefined ? data.targetAudience : currentPrompt.targetAudience || '',
            contentGoals: data.contentGoals !== undefined ? data.contentGoals : currentPrompt.contentGoals || [],
            avoidTopics: data.avoidTopics !== undefined ? data.avoidTopics : currentPrompt.avoidTopics || [],
            preferredFormats:
                data.preferredFormats !== undefined ? data.preferredFormats : currentPrompt.preferredFormats || [],
            additionalContext:
                data.additionalContext !== undefined
                    ? data.additionalContext
                    : currentPrompt.additionalContext || '',
        }

        // Обновить в БД
        const updated = await this.repository.updateMainPrompt(workspaceId, updatedPrompt)

        if (!updated) {
            throw new BaseAppError('Failed to update main prompt', ErrorCode.UNKNOWN_ERROR, 500)
        }

        return updatedPrompt
    }

    async getDefaultWorkspace(userId: string): Promise<WorkspaceDto | null> {
        this.logger.info('Getting default workspace', { userId })

        const workspace = await this.repository.findDefaultByUserId(userId)

        if (!workspace) {
            // Если нет дефолтного, но есть хотя бы один workspace - вернем его
            const workspaces = await this.repository.findByUserId(userId)

            if (workspaces.length === 0) {
                return null
            }

            // Если есть только один workspace - автоматически делаем его дефолтным
            if (workspaces.length === 1) {
                const defaultWorkspace = await this.repository.setAsDefault(workspaces[0].id, userId)
                return defaultWorkspace ? toWorkspaceDto(defaultWorkspace) : null
            }

            // Если workspace несколько, но нет дефолтного - вернем первый
            return toWorkspaceDto(workspaces[0])
        }

        return toWorkspaceDto(workspace)
    }

    async setDefaultWorkspace(workspaceId: string, userId: string): Promise<WorkspaceDto> {
        this.logger.info('Setting default workspace', { workspaceId, userId })

        // Проверяем, что workspace существует и принадлежит пользователю
        const workspace = await this.repository.findById(workspaceId)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        // Устанавливаем как дефолтный
        const defaultWorkspace = await this.repository.setAsDefault(workspaceId, userId)

        if (!defaultWorkspace) {
            throw new BaseAppError('Failed to set default workspace', ErrorCode.UNKNOWN_ERROR, 500)
        }

        this.logger.info('Workspace set as default', { workspaceId, userId })

        return toWorkspaceDto(defaultWorkspace)
    }

    async getOnboarding(workspaceId: string, userId: string): Promise<Onboarding> {
        this.logger.info('Getting onboarding', { workspaceId, userId })

        const workspace = await this.repository.findById(workspaceId)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        if (!workspace.onboarding) {
            throw new BaseAppError('Onboarding not found', ErrorCode.NOT_FOUND, 404)
        }

        return workspace.onboarding as Onboarding
    }

    async updateOnboarding(workspaceId: string, userId: string, data: UpdateOnboardingInput): Promise<Onboarding> {
        this.logger.info('Updating onboarding', { workspaceId, userId })

        // Validate that client didn't send forbidden server-side fields
        validateOnboardingInput(data)

        const workspace = await this.repository.findById(workspaceId)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        if (!workspace.onboarding) {
            throw new BaseAppError('Onboarding not found', ErrorCode.NOT_FOUND, 404)
        }

        const currentOnboarding = workspace.onboarding as Onboarding

        // Merge current onboarding with update data
        const mergedInput = {
            goal: data.goal ?? currentOnboarding.goal,
            audience: data.audience ?? currentOnboarding.audience,
            voice: data.voice ?? currentOnboarding.voice,
            contentStrategy: data.contentStrategy ?? currentOnboarding.contentStrategy,
            constraints: data.constraints ?? currentOnboarding.constraints,
            sales: data.sales ?? currentOnboarding.sales,
            examples: data.examples ?? currentOnboarding.examples,
            additionalInfo: data.additionalInfo ?? currentOnboarding.additionalInfo,
        }

        // Normalize the merged data (this will update meta.updatedAt and recalculate sales if needed)
        const normalizedOnboarding = normalizeOnboarding(mergedInput, workspaceId)

        // Preserve the original createdAt
        normalizedOnboarding.meta.createdAt = currentOnboarding.meta.createdAt
        normalizedOnboarding.meta.version = currentOnboarding.meta.version + 1

        const updatedWorkspace = await this.repository.updateOnboarding(workspaceId, normalizedOnboarding)

        if (!updatedWorkspace) {
            throw new BaseAppError('Failed to update onboarding', ErrorCode.UNKNOWN_ERROR, 500)
        }

        this.logger.info('Onboarding updated', { workspaceId, userId })

        return updatedWorkspace.onboarding as Onboarding
    }
}
