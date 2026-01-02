import type { NextFunction, Request, Response } from 'express'

export interface IAuthController {
    signIn(req: Request, res: Response, next: NextFunction): Promise<void>
    signUp(req: Request, res: Response, next: NextFunction): Promise<void>
    forgetPassword(req: Request, res: Response, next: NextFunction): Promise<void>
    changePassword(req: Request, res: Response, next: NextFunction): Promise<void>
    googleCallback(req: Request, res: Response, next: NextFunction): Promise<void>
    logout(req: Request, res: Response, next: NextFunction): Promise<void>
    authMe(req: Request, res: Response, next: NextFunction): Promise<void>
    authRefresh(req: Request, res: Response, next: NextFunction): Promise<void>
}
