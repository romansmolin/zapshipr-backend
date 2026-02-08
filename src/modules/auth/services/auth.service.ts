import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

import type { AuthResult, IAuthService, RefreshResult, SignInInput, SignUpInput } from './auth-service.interface'
import { TokenService } from './token.service'
import { SignUpUseCase } from '../use-cases/sign-up.use-case'
import { SignInUseCase } from '../use-cases/sign-in.use-case'
import { RefreshTokenUseCase } from '../use-cases/refresh-token.use-case'
import { GetSessionUseCase } from '../use-cases/get-session.use-case'
import { GoogleCallbackUseCase } from '../use-cases/google-callback.use-case'
import { LogoutUseCase } from '../use-cases/logout.use-case'
import { ChangePasswordUseCase } from '../use-cases/change-password.use-case'
import { ForgetPasswordUseCase } from '../use-cases/forget-password.use-case'

/**
 * AuthService acts as a proxy/facade that delegates to individual use cases.
 * Each authentication operation is handled by a dedicated use case class.
 */
export class AuthService implements IAuthService {
    private readonly tokenService: TokenService
    private readonly signUpUseCase: SignUpUseCase
    private readonly signInUseCase: SignInUseCase
    private readonly refreshTokenUseCase: RefreshTokenUseCase
    private readonly getSessionUseCase: GetSessionUseCase
    private readonly googleCallbackUseCase: GoogleCallbackUseCase
    private readonly logoutUseCase: LogoutUseCase
    private readonly changePasswordUseCase: ChangePasswordUseCase
    private readonly forgetPasswordUseCase: ForgetPasswordUseCase

    constructor(userRepository: IUserRepository, logger: ILogger) {
        this.tokenService = new TokenService(userRepository, logger)

        // Initialize use cases
        this.signUpUseCase = new SignUpUseCase(userRepository, this.tokenService, logger)
        this.signInUseCase = new SignInUseCase(userRepository, this.tokenService, logger)
        this.refreshTokenUseCase = new RefreshTokenUseCase(this.tokenService, logger)
        this.getSessionUseCase = new GetSessionUseCase(this.tokenService, logger)
        this.googleCallbackUseCase = new GoogleCallbackUseCase(userRepository, this.tokenService, logger)
        this.logoutUseCase = new LogoutUseCase(logger)
        this.changePasswordUseCase = new ChangePasswordUseCase()
        this.forgetPasswordUseCase = new ForgetPasswordUseCase()
    }

    async signUp(payload: SignUpInput): Promise<AuthResult> {
        return this.signUpUseCase.execute(payload)
    }

    async signIn(payload: SignInInput): Promise<AuthResult> {
        return this.signInUseCase.execute(payload)
    }

    async changePassword(): Promise<void> {
        return this.changePasswordUseCase.execute()
    }

    async forgetPassword(): Promise<void> {
        return this.forgetPasswordUseCase.execute()
    }

    async getSession(refreshToken?: string): Promise<AuthResult> {
        return this.getSessionUseCase.execute(refreshToken)
    }

    async refresh(refreshToken?: string): Promise<RefreshResult> {
        return this.refreshTokenUseCase.execute(refreshToken)
    }

    async logout(): Promise<void> {
        return this.logoutUseCase.execute()
    }

    async googleCallback(code: string): Promise<AuthResult> {
        return this.googleCallbackUseCase.execute(code)
    }
}
