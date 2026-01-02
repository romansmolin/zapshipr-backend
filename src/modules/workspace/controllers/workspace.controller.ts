import type { Request, Response } from 'express'

import type { ILogger } from '@/shared/logger'

import type { IWorkspaceService } from '../services/workspace-service.interface'
import { createWorkspaceSchema, updateWorkspaceSchema } from '../validation/workspace.schemas'
import type { IWorkspaceController } from './workspace-controller.interface'

export class WorkspaceController implements IWorkspaceController {
    constructor(
        private service: IWorkspaceService,
        private logger: ILogger
    ) {}

    async create(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const body = createWorkspaceSchema.parse(req.body)

        this.logger.info('Create workspace request', { userId })

        const workspace = await this.service.create(userId, body)

        res.status(201).json(workspace)
    }

    async getById(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Get workspace by id request', { userId, workspaceId: id })

        const workspace = await this.service.getById(id, userId)

        res.json(workspace)
    }

    async getAll(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id

        this.logger.info('Get all workspaces request', { userId })

        const workspaces = await this.service.getByUserId(userId)

        res.json(workspaces)
    }

    async update(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params
        const body = updateWorkspaceSchema.parse(req.body)

        this.logger.info('Update workspace request', { userId, workspaceId: id })

        const workspace = await this.service.update(id, userId, body)

        res.json(workspace)
    }

    async delete(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Delete workspace request', { userId, workspaceId: id })

        await this.service.delete(id, userId)

        res.status(204).send()
    }

    async updateAvatar(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params
        const file = req.file

        if (!file) {
            res.status(400).json({ error: 'No file provided' })
            return
        }

        this.logger.info('Update workspace avatar request', { userId, workspaceId: id })

        const workspace = await this.service.updateAvatar(id, userId, file)

        res.json(workspace)
    }

    async getMainPrompt(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Get main prompt request', { userId, workspaceId: id })

        const mainPrompt = await this.service.getMainPrompt(id, userId)

        res.json(mainPrompt)
    }

    async updateMainPrompt(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Update main prompt request', { userId, workspaceId: id })

        const mainPrompt = await this.service.updateMainPrompt(id, userId, req.body)

        res.json(mainPrompt)
    }
}


