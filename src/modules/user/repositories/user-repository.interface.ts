import type { NewUser, User } from '../entity/user.schema'

export interface IUserRepository {
    createUser(user: NewUser): Promise<User>
    findByEmail(email: string): Promise<User | null>
    findById(id: string): Promise<User | null>
    updateRefreshToken(userId: string, refreshToken: string | null): Promise<void>
    updateUserPassword(userId: string, passwordHash: string): Promise<void>
}
