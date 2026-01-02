import type { NextFunction, Request, Response } from 'express'

export interface IUserController {
    getUserInfo(req: Request, res: Response, next: NextFunction): Promise<void>
}

