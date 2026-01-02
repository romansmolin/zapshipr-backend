"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceTagsService = void 0;
const app_error_1 = require("@/shared/errors/app-error");
class WorkspaceTagsService {
    constructor(tagsRepository, logger) {
        this.tagsRepository = tagsRepository;
        this.logger = logger;
    }
    async getTags(workspaceId, filters) {
        const tags = await this.tagsRepository.findByWorkspaceId(workspaceId, filters);
        this.logger.info('Retrieved workspace tags', {
            operation: 'WorkspaceTagsService.getTags',
            workspaceId,
            count: tags.length,
        });
        return {
            tags,
            total: tags.length,
        };
    }
    async createTag(workspaceId, data) {
        // Проверка дубликатов
        const existingTag = await this.tagsRepository.findByNameAndCategory(workspaceId, data.name.toLowerCase().trim(), data.category);
        if (existingTag) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                message: `Tag with name "${data.name}" and category "${data.category}" already exists`,
                httpCode: 409,
            });
        }
        // Создание тега
        const tag = await this.tagsRepository.create({
            workspaceId,
            name: data.name.toLowerCase().trim(),
            category: data.category,
            isUserCreated: true,
        });
        this.logger.info('Created workspace tag', {
            operation: 'WorkspaceTagsService.createTag',
            tagId: tag.id,
            workspaceId,
            name: tag.name,
            category: tag.category,
        });
        return tag;
    }
    async updateTag(tagId, name) {
        const tag = await this.tagsRepository.findByNameAndCategory('', name, 'other');
        if (!tag) {
            // Проверяем существование тега по ID через другой метод
            // Это можно улучшить, добавив findById в репозиторий
            const updated = await this.tagsRepository.update(tagId, {
                name: name.toLowerCase().trim(),
            });
            if (!updated) {
                throw new app_error_1.AppError({
                    errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                    message: 'Tag not found',
                    httpCode: 404,
                });
            }
            this.logger.info('Updated workspace tag', {
                operation: 'WorkspaceTagsService.updateTag',
                tagId,
                newName: name,
            });
            return updated;
        }
        const updated = await this.tagsRepository.update(tagId, {
            name: name.toLowerCase().trim(),
        });
        if (!updated) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                message: 'Tag not found',
                httpCode: 404,
            });
        }
        this.logger.info('Updated workspace tag', {
            operation: 'WorkspaceTagsService.updateTag',
            tagId,
            newName: name,
        });
        return updated;
    }
    async deleteTag(tagId) {
        const deleted = await this.tagsRepository.delete(tagId);
        if (!deleted) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                message: 'Tag not found',
                httpCode: 404,
            });
        }
        this.logger.info('Deleted workspace tag', {
            operation: 'WorkspaceTagsService.deleteTag',
            tagId,
        });
    }
}
exports.WorkspaceTagsService = WorkspaceTagsService;
