import path from 'path'
import bcrypt from 'bcryptjs'

import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader/media-uploader.interface'

import type { IMediaRepository } from '@/modules/media/repositories/media-repository.interface'

import type { IUserRepository } from '../repositories/user-repository.interface'
import type { User } from '../entity/user.schema'
import type { UpdateUserSettingsInput } from '../validation/user.schemas'

import { extractKeyFromUrl } from './_helpers'

export type UpdateUserSettingsDeps = {
    users: IUserRepository
    media: IMediaRepository
    mediaUploader: IMediaUploader
    logger: ILogger
}

export const updateUserSettings = async (
    { users, media, mediaUploader, logger }: UpdateUserSettingsDeps,
    userId: string,
    data: UpdateUserSettingsInput,
    avatarFile?: Express.Multer.File
): Promise<User> => {
    const user = await users.findById(userId)

    if (!user) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
            httpCode: 404,
        })
    }

    let nextAvatar = user.avatar ?? null

    if (data.newPassword) {
        if (user.passwordHash) {
            if (!data.currentPassword) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                    message: 'currentPassword is required',
                    httpCode: 400,
                })
            }

            const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.passwordHash)

            if (!isCurrentPasswordValid) {
                throw new AppError({
                    errorMessageCode: ErrorMessageCode.INVALID_CREDENTIALS,
                    httpCode: 401,
                })
            }
        }

        const passwordHash = await bcrypt.hash(data.newPassword, 10)
        await users.updateUserPassword(userId, passwordHash)
    }

    if (avatarFile) {
        if (!avatarFile.mimetype.startsWith('image/')) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'Avatar must be an image',
                httpCode: 400,
            })
        }

        const extension = path.extname(avatarFile.originalname) || '.jpg'
        const key = `${userId}/avatars/${Date.now()}${extension}`
        const uploadedAvatarUrl = await mediaUploader.upload({
            key,
            body: avatarFile.buffer,
            contentType: avatarFile.mimetype,
        })

        await media.create({
            userId,
            key,
            url: uploadedAvatarUrl,
            size: avatarFile.size,
            contentType: avatarFile.mimetype,
            lastModified: new Date(),
        })

        nextAvatar = uploadedAvatarUrl
    } else if (data.removeAvatar === true) {
        nextAvatar = null
    }

    const previousAvatar = user.avatar
    const shouldDeletePreviousAvatar =
        !!previousAvatar && (data.removeAvatar === true || (avatarFile && nextAvatar !== previousAvatar))

    if (shouldDeletePreviousAvatar) {
        try {
            await mediaUploader.delete(previousAvatar)
            const previousAvatarKey = extractKeyFromUrl(previousAvatar)
            if (previousAvatarKey) {
                await media.deleteByKey(previousAvatarKey)
            }
        } catch (error) {
            logger.warn('Failed to delete previous user avatar', {
                operation: 'updateUserSettings',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }
    }

    const hasProfileFields =
        data.name !== undefined || data.email !== undefined || nextAvatar !== (user.avatar ?? null)

    if (hasProfileFields) {
        return await users.updateUserProfile(userId, {
            name: data.name?.trim(),
            email: data.email?.trim().toLowerCase(),
            avatar: nextAvatar,
        })
    }

    const updatedUser = await users.findById(userId)

    if (!updatedUser) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.USER_NOT_FOUND,
            httpCode: 404,
        })
    }

    return updatedUser
}
