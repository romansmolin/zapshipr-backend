import type { IUserService } from '../services/user.service.interface'
import type { User } from '../entity/user.schema'

export interface GetUserInfoInput {
    userId: string
}

export interface GetUserInfoOutput {
    user: User
}

export const getUserInfoUseCase = async (
    input: GetUserInfoInput,
    userService: IUserService
): Promise<GetUserInfoOutput> => {
    const user = await userService.getUserInfo(input.userId)

    return { user }
}
