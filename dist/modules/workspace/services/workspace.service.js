"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const workspace_dto_1 = require("../entity/workspace.dto");
class WorkspaceService {
    constructor(repository, logger) {
        this.repository = repository;
        this.logger = logger;
    }
    async create(userId, data) {
        this.logger.info('Creating workspace', { userId, name: data.name });
        // Проверяем, есть ли у пользователя уже workspaces
        const workspacesCount = await this.repository.countByUserId(userId);
        const isFirstWorkspace = workspacesCount === 0;
        const workspace = await this.repository.create({
            userId,
            name: data.name,
            description: data.description || null,
            isDefault: isFirstWorkspace, // Если это первый workspace - делаем его дефолтным
        });
        this.logger.info('Workspace created', {
            workspaceId: workspace.id,
            isDefault: workspace.isDefault,
            isFirstWorkspace,
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
            additionalContext: data.additionalContext !== undefined
                ? data.additionalContext
                : currentPrompt.additionalContext || '',
        };
        // Обновить в БД
        const updated = await this.repository.updateMainPrompt(workspaceId, updatedPrompt);
        if (!updated) {
            throw new base_error_1.BaseAppError('Failed to update main prompt', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        return updatedPrompt;
    }
    async getDefaultWorkspace(userId) {
        this.logger.info('Getting default workspace', { userId });
        const workspace = await this.repository.findDefaultByUserId(userId);
        if (!workspace) {
            // Если нет дефолтного, но есть хотя бы один workspace - вернем его
            const workspaces = await this.repository.findByUserId(userId);
            if (workspaces.length === 0) {
                return null;
            }
            // Если есть только один workspace - автоматически делаем его дефолтным
            if (workspaces.length === 1) {
                const defaultWorkspace = await this.repository.setAsDefault(workspaces[0].id, userId);
                return defaultWorkspace ? (0, workspace_dto_1.toWorkspaceDto)(defaultWorkspace) : null;
            }
            // Если workspace несколько, но нет дефолтного - вернем первый
            return (0, workspace_dto_1.toWorkspaceDto)(workspaces[0]);
        }
        return (0, workspace_dto_1.toWorkspaceDto)(workspace);
    }
    async setDefaultWorkspace(workspaceId, userId) {
        this.logger.info('Setting default workspace', { workspaceId, userId });
        // Проверяем, что workspace существует и принадлежит пользователю
        const workspace = await this.repository.findById(workspaceId);
        if (!workspace) {
            throw new base_error_1.BaseAppError('Workspace not found', error_codes_const_1.ErrorCode.NOT_FOUND, 404);
        }
        if (workspace.userId !== userId) {
            throw new base_error_1.BaseAppError('Access denied', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
        }
        // Устанавливаем как дефолтный
        const defaultWorkspace = await this.repository.setAsDefault(workspaceId, userId);
        if (!defaultWorkspace) {
            throw new base_error_1.BaseAppError('Failed to set default workspace', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        this.logger.info('Workspace set as default', { workspaceId, userId });
        return (0, workspace_dto_1.toWorkspaceDto)(defaultWorkspace);
    }
}
exports.WorkspaceService = WorkspaceService;
