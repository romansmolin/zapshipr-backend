import { ErrorCode } from '@/shared/consts/error-codes.const'

export class BaseAppError extends Error {
    public readonly code: ErrorCode
    public readonly httpCode: number

    constructor(message: string, code: ErrorCode, httpCode: number) {
        super(message)
        this.name = 'BaseAppError'
        this.code = code
        this.httpCode = httpCode
        Object.setPrototypeOf(this, BaseAppError.prototype)
    }
}
