import type { NextFunction, Request, Response } from 'express'

import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'
import { toUserResponse } from '@/modules/user/entity/user.dto'

import type { IUserController } from './user-controller.interface'
import type { IUserService } from '../services/user.service.interface'

export class UserController implements IUserController {
    private readonly userService: IUserService
    private readonly logger: ILogger

    constructor(userService: IUserService, logger: ILogger) {
        this.userService = userService
        this.logger = logger
    }

    async getUserInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const userInfo = await this.userService.getUserInfo(userId)

        res.json({
            user: toUserResponse(userInfo.user),
            planName: userInfo.planName,
        })
    }

    private getUserId(req: Request): string {
        const userId = req.user?.id

        if (!userId) {
            throw new BaseAppError('Unauthorized', ErrorCode.UNAUTHORIZED, 401)
        }

        return userId
    }
}
