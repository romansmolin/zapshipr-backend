import type { User } from '@/modules/user/entity/user.schema'

export interface SignUpInput {
    name: string
    email: string
    password: string
}

export interface SignInInput {
    email: string
    password: string
}

export interface AuthResult {
    user: User
    accessToken: string
    refreshToken: string
}

export interface RefreshResult {
    accessToken: string
    refreshToken: string
}

export interface IAuthService {
    signIn(payload: SignInInput): Promise<AuthResult>
    signUp(payload: SignUpInput): Promise<AuthResult>
    googleCallback(code: string): Promise<AuthResult>
    changePassword(): Promise<void>
    forgetPassword(): Promise<void>
    getSession(refreshToken?: string): Promise<AuthResult>
    refresh(refreshToken?: string): Promise<RefreshResult>
    logout(): Promise<void>
}
