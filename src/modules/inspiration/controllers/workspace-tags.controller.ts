import type { Request, Response } from 'express'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IWorkspaceTagsService } from '../services/workspace-tags/workspace-tags-service.interface'
import { CreateTagSchema, GetTagsQuerySchema, UpdateTagSchema } from '../validation/inspirations.schemas'

export class WorkspaceTagsController {
    constructor(
        private readonly tagsService: IWorkspaceTagsService,
        private readonly logger: ILogger
    ) {}

    async getTags(req: Request, res: Response): Promise<void> {
        const { workspaceId } = req.params

        // Валидация query параметров
        const query = GetTagsQuerySchema.parse(req.query)

        const result = await this.tagsService.getTags(workspaceId, query)

        res.status(200).json(result)
    }

    async createTag(req: Request, res: Response): Promise<void> {
        const { workspaceId } = req.params

        // Валидация body
        const data = CreateTagSchema.parse(req.body)

        const tag = await this.tagsService.createTag(workspaceId, data)

        res.status(201).json(tag)
    }

    async updateTag(req: Request, res: Response): Promise<void> {
        const { tagId } = req.params

        // Валидация body
        const { name } = UpdateTagSchema.parse(req.body)

        const tag = await this.tagsService.updateTag(tagId, name)

        res.status(200).json(tag)
    }

    async deleteTag(req: Request, res: Response): Promise<void> {
        const { tagId } = req.params

        await this.tagsService.deleteTag(tagId)

        res.status(204).send()
    }
}

