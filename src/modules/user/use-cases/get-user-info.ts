import type { IUserService, UserInfo } from '../services/user.service.interface'

export interface GetUserInfoInput {
    userId: string
}

export const getUserInfoUseCase = async (
    input: GetUserInfoInput,
    userService: IUserService
): Promise<UserInfo> => {
    return await userService.getUserInfo(input.userId)
}
