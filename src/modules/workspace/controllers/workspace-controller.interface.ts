import type { Request, Response } from 'express'

export interface IWorkspaceController {
    create(req: Request, res: Response): Promise<void>
    getById(req: Request, res: Response): Promise<void>
    getAll(req: Request, res: Response): Promise<void>
    getDefault(req: Request, res: Response): Promise<void>
    update(req: Request, res: Response): Promise<void>
    delete(req: Request, res: Response): Promise<void>
    getMainPrompt(req: Request, res: Response): Promise<void>
    updateMainPrompt(req: Request, res: Response): Promise<void>
    getOnboarding(req: Request, res: Response): Promise<void>
    updateOnboarding(req: Request, res: Response): Promise<void>
    setAsDefault(req: Request, res: Response): Promise<void>
    getAIContext(req: Request, res: Response): Promise<void>
    getTags(req: Request, res: Response): Promise<void>
    createTag(req: Request, res: Response): Promise<void>
    updateTag(req: Request, res: Response): Promise<void>
    deleteTag(req: Request, res: Response): Promise<void>
}
