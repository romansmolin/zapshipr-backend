import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { IWorkspaceTagsRepository } from '../../repositories/workspace-tags-repository.interface'
import type {
    IWorkspaceTagsService,
    GetTagsFilters,
    TagsListResponse,
    CreateTagData,
} from './workspace-tags-service.interface'
import type { WorkspaceTag } from '../../entity/workspace-tag.schema'

export class WorkspaceTagsService implements IWorkspaceTagsService {
    constructor(
        private readonly tagsRepository: IWorkspaceTagsRepository,
        private readonly logger: ILogger
    ) {}

    async getTags(workspaceId: string, filters?: GetTagsFilters): Promise<TagsListResponse> {
        const tags = await this.tagsRepository.findByWorkspaceId(workspaceId, filters)

        this.logger.info('Retrieved workspace tags', {
            operation: 'WorkspaceTagsService.getTags',
            workspaceId,
            count: tags.length,
        })

        return {
            tags,
            total: tags.length,
        }
    }

    async createTag(workspaceId: string, data: CreateTagData): Promise<WorkspaceTag> {
        // Проверка дубликатов
        const existingTag = await this.tagsRepository.findByNameAndCategory(
            workspaceId,
            data.name.toLowerCase().trim(),
            data.category
        )

        if (existingTag) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: `Tag with name "${data.name}" and category "${data.category}" already exists`,
                httpCode: 409,
            })
        }

        // Создание тега
        const tag = await this.tagsRepository.create({
            workspaceId,
            name: data.name.toLowerCase().trim(),
            category: data.category,
            isUserCreated: true,
        })

        this.logger.info('Created workspace tag', {
            operation: 'WorkspaceTagsService.createTag',
            tagId: tag.id,
            workspaceId,
            name: tag.name,
            category: tag.category,
        })

        return tag
    }

    async updateTag(tagId: string, name: string): Promise<WorkspaceTag> {
        const tag = await this.tagsRepository.findByNameAndCategory('', name, 'other')

        if (!tag) {
            // Проверяем существование тега по ID через другой метод
            // Это можно улучшить, добавив findById в репозиторий
            const updated = await this.tagsRepository.update(tagId, {
                name: name.toLowerCase().trim(),
            })

            if (!updated) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                    message: 'Tag not found',
                    httpCode: 404,
                })
            }

            this.logger.info('Updated workspace tag', {
                operation: 'WorkspaceTagsService.updateTag',
                tagId,
                newName: name,
            })

            return updated
        }

        const updated = await this.tagsRepository.update(tagId, {
            name: name.toLowerCase().trim(),
        })

        if (!updated) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'Tag not found',
                httpCode: 404,
            })
        }

        this.logger.info('Updated workspace tag', {
            operation: 'WorkspaceTagsService.updateTag',
            tagId,
            newName: name,
        })

        return updated
    }

    async deleteTag(tagId: string): Promise<void> {
        const deleted = await this.tagsRepository.delete(tagId)

        if (!deleted) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'Tag not found',
                httpCode: 404,
            })
        }

        this.logger.info('Deleted workspace tag', {
            operation: 'WorkspaceTagsService.deleteTag',
            tagId,
        })
    }
}

