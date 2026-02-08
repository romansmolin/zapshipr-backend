import type { NextFunction, Request, Response } from 'express'

import { BaseAppError } from '@/shared/errors/base-error'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import type { ILogger } from '@/shared/logger/logger.interface'
import { toUserResponse } from '@/modules/user/entity/user.dto'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'

import type { IUserController } from './user-controller.interface'
import type { IUserService } from '../services/user.service.interface'
import { updateUserSettingsSchema } from '../validation/user.schemas'

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
            userWorkspaces: userInfo.userWorkspaces,
        })
    }

    async updateUserSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)
        const body = updateUserSettingsSchema.parse(req.body)
        const avatarFile = req.file

        if (
            !avatarFile &&
            body.name === undefined &&
            body.email === undefined &&
            body.newPassword === undefined &&
            body.removeAvatar === undefined
        ) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'No settings provided for update',
                httpCode: 400,
            })
        }

        const user = await this.userService.updateUserSettings(userId, body, avatarFile)

        res.json({
            user: toUserResponse(user),
        })
    }

    async deleteUserAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
        const userId = this.getUserId(req)

        this.logger.info('Deleting user account', {
            operation: 'UserController.deleteUserAccount',
            userId,
        })

        await this.userService.deleteUserAccout(userId)

        res.json({
            message: 'User account deleted successfully',
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
