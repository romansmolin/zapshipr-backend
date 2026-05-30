import type { IUserRepository } from '@/modules/user/repositories/user-repository.interface'
import type { IEmailService } from '@/modules/email/services/email/email.service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

import type {
    AuthResult,
    ForgotPasswordInput,
    IAuthService,
    RefreshResult,
    ResetPasswordInput,
    SignInInput,
    SignUpInput,
} from './auth-service.interface'
import { TokenService } from '../token/token.service'

import { signUp as signUpUseCase } from '../../use-cases/sign-up.use-case'
import { signIn as signInUseCase } from '../../use-cases/sign-in.use-case'
import { refreshToken as refreshTokenUseCase } from '../../use-cases/refresh-token.use-case'
import { getSession as getSessionUseCase } from '../../use-cases/get-session.use-case'
import { googleCallback as googleCallbackUseCase } from '../../use-cases/google-callback.use-case'
import { logout as logoutUseCase } from '../../use-cases/logout.use-case'
import { changePassword as changePasswordUseCase } from '../../use-cases/change-password.use-case'
import { forgetPassword as forgetPasswordUseCase } from '../../use-cases/forget-password.use-case'

type AuthDeps = {
    users: IUserRepository
    tokens: TokenService
    emailService: IEmailService
    logger: ILogger
}

export class AuthService implements IAuthService {
    private readonly deps: AuthDeps

    constructor(userRepository: IUserRepository, emailService: IEmailService, logger: ILogger) {
        const tokens = new TokenService(userRepository, logger)
        this.deps = { users: userRepository, tokens, emailService, logger }
    }

    signUp(payload: SignUpInput): Promise<AuthResult> {
        return signUpUseCase(this.deps, payload)
    }

    signIn(payload: SignInInput): Promise<AuthResult> {
        return signInUseCase(this.deps, payload)
    }

    changePassword(payload: ResetPasswordInput): Promise<void> {
        return changePasswordUseCase(this.deps, payload)
    }

    forgetPassword(payload: ForgotPasswordInput): Promise<void> {
        return forgetPasswordUseCase(this.deps, payload)
    }

    getSession(refreshToken?: string): Promise<AuthResult> {
        return getSessionUseCase(this.deps, refreshToken)
    }

    refresh(refreshToken?: string): Promise<RefreshResult> {
        return refreshTokenUseCase(this.deps, refreshToken)
    }

    logout(): Promise<void> {
        return logoutUseCase(this.deps)
    }

    googleCallback(code: string): Promise<AuthResult> {
        return googleCallbackUseCase(this.deps, code)
    }
}
