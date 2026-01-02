import type { Request, Response } from 'express'

export interface IWorkspaceController {
    create(req: Request, res: Response): Promise<void>
    getById(req: Request, res: Response): Promise<void>
    getAll(req: Request, res: Response): Promise<void>
    getDefault(req: Request, res: Response): Promise<void>
    update(req: Request, res: Response): Promise<void>
    delete(req: Request, res: Response): Promise<void>
    updateAvatar(req: Request, res: Response): Promise<void>
    setAsDefault(req: Request, res: Response): Promise<void>
}


