export enum ErrorMessageCode {
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    UNAUTHORIZED = 'UNAUTHORIZED',
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    WORKSPACE_SLUG_EXISTS = 'WORKSPACE_SLUG_EXISTS',
    SOCIAL_ACCOUNT_ALREADY_EXISTS = 'SOCIAL_ACCOUNT_ALREADY_EXISTS',
    SOCIAL_ACCOUNT_NOT_FOUND = 'SOCIAL_ACCOUNT_NOT_FOUND',
    DUPLICATE_INSPIRATION = 'DUPLICATE_INSPIRATION',
    INSPIRATION_NOT_FOUND = 'INSPIRATION_NOT_FOUND',
}

export interface ErrorField {
    field: string
    errorMessageCode: string
}

export interface ErrorResponseBody {
    errorMessageCode: string
    httpCode: number
    fields?: ErrorField[]
}

export class AppError extends Error {
    public readonly httpCode: number
    public readonly errorMessageCode: string
    public readonly fields?: ErrorField[]

    constructor(params: { message?: string; errorMessageCode: string; httpCode: number; fields?: ErrorField[] }) {
        super(params.message ?? params.errorMessageCode)
        this.name = 'AppError'
        this.httpCode = params.httpCode
        this.errorMessageCode = params.errorMessageCode
        this.fields = params.fields
        Object.setPrototypeOf(this, AppError.prototype)
    }
}
