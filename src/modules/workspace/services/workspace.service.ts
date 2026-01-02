import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import type { ILogger } from '@/shared/logger'
import type { IMediaUploader } from '@/shared/media-uploader'

import { toWorkspaceDto, type WorkspaceDto } from '../entity/workspace.dto'
import type { IWorkspaceRepository } from '../repositories/workspace-repository.interface'
import type { CreateWorkspaceInput, UpdateWorkspaceInput, MainPrompt, UpdateMainPrompt } from '../validation/workspace.schemas'
import type { IWorkspaceService } from './workspace-service.interface'

export class WorkspaceService implements IWorkspaceService {
    constructor(
        private repository: IWorkspaceRepository,
        private mediaUploader: IMediaUploader,
        private logger: ILogger
    ) {}

    async create(userId: string, data: CreateWorkspaceInput): Promise<WorkspaceDto> {
        this.logger.info('Creating workspace', { userId, name: data.name })

        const workspace = await this.repository.create({
            userId,
            name: data.name,
            description: data.description || null,
        })

        return toWorkspaceDto(workspace)
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
            throw new BaseAppError('Failed to update workspace', ErrorCode.INTERNAL_SERVER_ERROR, 500)
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

    async updateAvatar(id: string, userId: string, file: Express.Multer.File): Promise<WorkspaceDto> {
        this.logger.info('Updating workspace avatar', { workspaceId: id, userId })

        const workspace = await this.repository.findById(id)

        if (!workspace) {
            throw new BaseAppError('Workspace not found', ErrorCode.NOT_FOUND, 404)
        }

        if (workspace.userId !== userId) {
            throw new BaseAppError('Access denied', ErrorCode.FORBIDDEN, 403)
        }

        const avatarUrl = await this.mediaUploader.upload(file, `workspaces/${id}`)

        const updatedWorkspace = await this.repository.updateAvatar(id, avatarUrl)

        if (!updatedWorkspace) {
            throw new BaseAppError('Failed to update workspace avatar', ErrorCode.INTERNAL_SERVER_ERROR, 500)
        }

        return toWorkspaceDto(updatedWorkspace)
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
            targetAudience: data.targetAudience !== undefined ? data.targetAudience : currentPrompt.targetAudience || '',
            contentGoals: data.contentGoals !== undefined ? data.contentGoals : currentPrompt.contentGoals || [],
            avoidTopics: data.avoidTopics !== undefined ? data.avoidTopics : currentPrompt.avoidTopics || [],
            preferredFormats: data.preferredFormats !== undefined ? data.preferredFormats : currentPrompt.preferredFormats || [],
            additionalContext: data.additionalContext !== undefined ? data.additionalContext : currentPrompt.additionalContext || '',
        }

        // Обновить в БД
        const updated = await this.repository.updateMainPrompt(workspaceId, updatedPrompt)

        if (!updated) {
            throw new BaseAppError('Failed to update main prompt', ErrorCode.INTERNAL_SERVER_ERROR, 500)
        }

        return updatedPrompt
    }
}


