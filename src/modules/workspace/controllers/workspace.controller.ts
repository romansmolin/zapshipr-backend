import type { Request, Response } from 'express'

import type { ILogger } from '@/shared/logger'
import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'

import type { IWorkspaceService } from '../services/workspace/workspace-service.interface'
import type { IWorkspaceProfileService } from '../services/workspace-profile/workspace-profile.service'
import type { IWorkspaceTagsService } from '@/modules/inspiration/services/workspace-tags/workspace-tags-service.interface'
import { createWorkspaceSchema, updateWorkspaceSchema } from '../validation/workspace.schemas'
import { updateOnboardingInputSchema } from '../validation/onboarding.schemas'
import { createTagSchema, updateTagSchema, getTagsQuerySchema, tagIdParamSchema } from '../validation/tags.schemas'
import type { IWorkspaceController } from './workspace-controller.interface'

export class WorkspaceController implements IWorkspaceController {
    constructor(
        private service: IWorkspaceService,
        private tagsService: IWorkspaceTagsService,
        private profileService: IWorkspaceProfileService,
        private logger: ILogger
    ) {}

    async create(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        let onboarding = req.body.onboarding

        if (typeof onboarding === 'string') {
            try {
                onboarding = JSON.parse(onboarding)
            } catch (_error) {
                throw new BaseAppError('Invalid onboarding JSON', ErrorCode.BAD_REQUEST, 400)
            }
        }

        const body = createWorkspaceSchema.parse({
            ...req.body,
            onboarding,
        })
        const file = req.file

        this.logger.info('Create workspace request', { userId })

        const workspace = await this.service.create(userId, body, file)

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
        const file = req.file

        this.logger.info('Update workspace request', { userId, workspaceId: id })

        const workspace = await this.service.update(id, userId, body, file)

        res.json(workspace)
    }

    async delete(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Delete workspace request', { userId, workspaceId: id })

        await this.service.delete(id, userId)

        res.status(204).send()
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

    async getDefault(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id

        this.logger.info('Get default workspace request', { userId })

        const workspace = await this.service.getDefaultWorkspace(userId)

        if (!workspace) {
            res.status(404).json({ message: 'No workspaces found' })
            return
        }

        res.json(workspace)
    }

    async setAsDefault(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Set workspace as default request', { userId, workspaceId: id })

        const workspace = await this.service.setDefaultWorkspace(id, userId)

        res.json(workspace)
    }

    async getOnboarding(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Get onboarding request', { userId, workspaceId: id })

        const onboarding = await this.service.getOnboarding(id, userId)

        res.json(onboarding)
    }

    async updateOnboarding(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params
        const body = updateOnboardingInputSchema.parse(req.body)

        this.logger.info('Update onboarding request', { userId, workspaceId: id })

        const onboarding = await this.service.updateOnboarding(id, userId, body)

        res.json(onboarding)
    }

    async getAIContext(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params

        this.logger.info('Get AI context request', { userId, workspaceId: id })

        const context = await this.service.getAIContext(id, userId)

        res.json(context)
    }

    async getTags(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params
        const query = getTagsQuerySchema.parse(req.query)

        this.logger.info('Get tags request', { userId, workspaceId: id })

        await this.service.verifyWorkspaceAccess(id, userId)

        const result = await this.tagsService.getTags(id, {
            category: query.category,
            sortBy: query.sortBy,
            order: query.order,
        })

        res.json(result)
    }

    async createTag(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id } = req.params
        const body = createTagSchema.parse(req.body)

        this.logger.info('Create tag request', { userId, workspaceId: id })

        await this.service.verifyWorkspaceAccess(id, userId)

        const tag = await this.tagsService.createTag(id, {
            name: body.name,
            category: body.category,
        })

        // Record signal
        await this.profileService.recordSignal(id, {
            type: 'tag_created',
            source: 'user_action',
            data: { tagName: tag.name, category: tag.category },
        })

        res.status(201).json({ tag })
    }

    async updateTag(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id, tagId } = req.params
        const body = updateTagSchema.parse(req.body)

        this.logger.info('Update tag request', { userId, workspaceId: id, tagId })

        await this.service.verifyWorkspaceAccess(id, userId)

        const tag = await this.tagsService.updateTag(tagId, body.name)

        res.json({ tag })
    }

    async deleteTag(req: Request, res: Response): Promise<void> {
        const userId = req.user!.id
        const { id, tagId } = req.params

        this.logger.info('Delete tag request', { userId, workspaceId: id, tagId })

        await this.service.verifyWorkspaceAccess(id, userId)

        await this.tagsService.deleteTag(tagId)

        res.status(204).send()
    }
}
