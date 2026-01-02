import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { AppError, ErrorMessageCode, type ErrorField, type ErrorResponseBody } from '@/shared/errors/app-error'
import { BaseAppError } from '@/shared/errors/base-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'

const buildValidationFields = (error: ZodError): ErrorField[] => {
    return error.issues.map((issue) => ({
        field: issue.path.join('.') || 'form',
        errorMessageCode: issue.message || ErrorMessageCode.VALIDATION_ERROR,
    }))
}

const mapErrorToResponse = (error: unknown): ErrorResponseBody => {
    if (error instanceof AppError) {
        return {
            errorMessageCode: error.errorMessageCode,
            httpCode: error.httpCode,
            fields: error.fields,
        }
    }

    if (error instanceof BaseAppError) {
        return {
            errorMessageCode: error.code,
            httpCode: error.httpCode,
        }
    }

    if (error instanceof ZodError) {
        return {
            errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
            httpCode: 400,
            fields: buildValidationFields(error),
        }
    }

    return {
        errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
        httpCode: 500,
    }
}

export const createErrorHandler =
    (logger: ILogger) => (error: unknown, req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) return next(error)

        const body = mapErrorToResponse(error)

        logger.error('Request failed', {
            operation: `${req.method} ${req.originalUrl}`,
            error: formatError(error),
        })

        res.status(body.httpCode).json(body)
    }
