import type { WorkspaceTag } from '../../entity/workspace-tag.schema'

export interface GetTagsFilters {
    category?: 'topic' | 'format' | 'tone' | 'style' | 'other'
    sortBy?: 'name' | 'usageCount'
    order?: 'asc' | 'desc'
}

export interface TagsListResponse {
    tags: WorkspaceTag[]
    total: number
}

export interface CreateTagData {
    name: string
    category: 'topic' | 'format' | 'tone' | 'style' | 'other'
}

export interface IWorkspaceTagsService {
    /**
     * Получить все теги workspace
     */
    getTags(workspaceId: string, filters?: GetTagsFilters): Promise<TagsListResponse>

    /**
     * Создать тег вручную
     */
    createTag(workspaceId: string, data: CreateTagData): Promise<WorkspaceTag>

    /**
     * Обновить тег (только name)
     */
    updateTag(tagId: string, name: string): Promise<WorkspaceTag>

    /**
     * Удалить тег
     */
    deleteTag(tagId: string): Promise<void>
}

