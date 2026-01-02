import type { NextFunction, Request, Response } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'

import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const tokenFromCookie = req.cookies?.token

    const token = tokenFromHeader ?? tokenFromCookie

    if (!token) {
        throw new AppError({ errorMessageCode: ErrorMessageCode.UNAUTHORIZED, httpCode: 401 })
    }

    const accessSecret = process.env.JWT_ACCESS_SECRET
    const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'change-me'

    let payload: JwtPayload | string | null = null

    // If token is from Authorization header, try to verify as access token first
    if (tokenFromHeader && accessSecret) {
        try {
            payload = jwt.verify(token, accessSecret) as JwtPayload | string
        } catch {
            // Not an access token, will try refresh token below
        }
    }

    // If not verified as access token (or from cookie), try refresh token
    if (!payload) {
        try {
            payload = jwt.verify(token, refreshSecret) as JwtPayload | string
        } catch (error) {
            throw new AppError({ errorMessageCode: ErrorMessageCode.UNAUTHORIZED, httpCode: 401 })
        }
    }

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        throw new AppError({ errorMessageCode: ErrorMessageCode.UNAUTHORIZED, httpCode: 401 })
    }

    req.user = {
        id: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
    }

    next()
}
