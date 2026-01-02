"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const workspace_dto_1 = require("../entity/workspace.dto");
class WorkspaceService {
    constructor(repository, mediaUploader, logger) {
        this.repository = repository;
        this.mediaUploader = mediaUploader;
        this.logger = logger;
    }
    async create(userId, data) {
        this.logger.info('Creating workspace', { userId, name: data.name });
        const workspace = await this.repository.create({
            userId,
            name: data.name,
            description: data.description || null,
        });
        return (0, workspace_dto_1.toWorkspaceDto)(workspace);
    }
    async getById(id, userId) {
        this.logger.info('Getting workspace by id', { workspaceId: id, userId });
        const workspace = await this.repository.findById(id);
        if (!workspace) {
            throw new base_error_1.BaseAppError('Workspace not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        if (workspace.userId !== userId) {
            throw new base_error_1.BaseAppError('Access denied', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
        }
        return (0, workspace_dto_1.toWorkspaceDto)(workspace);
    }
    async getByUserId(userId) {
        this.logger.info('Getting workspaces by user id', { userId });
        const workspaces = await this.repository.findByUserId(userId);
        return workspaces.map(workspace_dto_1.toWorkspaceDto);
    }
    async update(id, userId, data) {
        this.logger.info('Updating workspace', { workspaceId: id, userId });
        const existingWorkspace = await this.repository.findById(id);
        if (!existingWorkspace) {
            throw new base_error_1.BaseAppError('Workspace not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        if (existingWorkspace.userId !== userId) {
            throw new base_error_1.BaseAppError('Access denied', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
        }
        const workspace = await this.repository.update(id, {
            name: data.name,
            description: data.description,
        });
        if (!workspace) {
            throw new base_error_1.BaseAppError('Failed to update workspace', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        return (0, workspace_dto_1.toWorkspaceDto)(workspace);
    }
    async delete(id, userId) {
        this.logger.info('Deleting workspace', { workspaceId: id, userId });
        const workspace = await this.repository.findById(id);
        if (!workspace) {
            throw new base_error_1.BaseAppError('Workspace not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        if (workspace.userId !== userId) {
            throw new base_error_1.BaseAppError('Access denied', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
        }
        await this.repository.delete(id);
    }
    async updateAvatar(id, userId, file) {
        this.logger.info('Updating workspace avatar', { workspaceId: id, userId });
        const workspace = await this.repository.findById(id);
        if (!workspace) {
            throw new base_error_1.BaseAppError('Workspace not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        if (workspace.userId !== userId) {
            throw new base_error_1.BaseAppError('Access denied', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
        }
        const avatarUrl = await this.mediaUploader.upload({
            key: `workspaces/${id}/avatar/${file.originalname}`,
            body: file.buffer,
            contentType: file.mimetype,
        });
        const updatedWorkspace = await this.repository.updateAvatar(id, avatarUrl);
        if (!updatedWorkspace) {
            throw new base_error_1.BaseAppError('Failed to update workspace avatar', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        return (0, workspace_dto_1.toWorkspaceDto)(updatedWorkspace);
    }
    async getMainPrompt(workspaceId, userId) {
        this.logger.info('Getting main prompt', { workspaceId, userId });
        const workspace = await this.repository.findById(workspaceId);
        if (!workspace) {
            throw new base_error_1.BaseAppError('Workspace not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        if (workspace.userId !== userId) {
            throw new base_error_1.BaseAppError('Access denied', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
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
            };
        }
        return workspace.mainPrompt;
    }
    async updateMainPrompt(workspaceId, userId, data) {
        this.logger.info('Updating main prompt', { workspaceId, userId });
        const workspace = await this.repository.findById(workspaceId);
        if (!workspace) {
            throw new base_error_1.BaseAppError('Workspace not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        if (workspace.userId !== userId) {
            throw new base_error_1.BaseAppError('Access denied', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
        }
        // Merge с существующим prompt
        const currentPrompt = workspace.mainPrompt || {
            brandVoice: '',
            coreThemes: [],
            targetAudience: '',
            contentGoals: [],
            avoidTopics: [],
            preferredFormats: [],
            additionalContext: '',
        };
        const updatedPrompt = {
            brandVoice: data.brandVoice !== undefined ? data.brandVoice : currentPrompt.brandVoice || '',
            coreThemes: data.coreThemes !== undefined ? data.coreThemes : currentPrompt.coreThemes || [],
            targetAudience: data.targetAudience !== undefined ? data.targetAudience : currentPrompt.targetAudience || '',
            contentGoals: data.contentGoals !== undefined ? data.contentGoals : currentPrompt.contentGoals || [],
            avoidTopics: data.avoidTopics !== undefined ? data.avoidTopics : currentPrompt.avoidTopics || [],
            preferredFormats: data.preferredFormats !== undefined ? data.preferredFormats : currentPrompt.preferredFormats || [],
            additionalContext: data.additionalContext !== undefined ? data.additionalContext : currentPrompt.additionalContext || '',
        };
        // Обновить в БД
        const updated = await this.repository.updateMainPrompt(workspaceId, updatedPrompt);
        if (!updated) {
            throw new base_error_1.BaseAppError('Failed to update main prompt', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        return updatedPrompt;
    }
}
exports.WorkspaceService = WorkspaceService;
