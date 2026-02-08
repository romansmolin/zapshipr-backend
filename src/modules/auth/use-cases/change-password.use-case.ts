import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'

export class ChangePasswordUseCase {
    async execute(): Promise<void> {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.NOT_IMPLEMENTED,
            httpCode: 501,
        })
    }
}
