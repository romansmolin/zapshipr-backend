import bodyParser from 'body-parser'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

export const createApp = () => {
    const app = express()

    if (process.env.TRUST_PROXY) {
        const trustProxyValue = process.env.TRUST_PROXY.trim()
        const lowerValue = trustProxyValue.toLowerCase()
        if (lowerValue === 'true') {
            app.set('trust proxy', true)
        } else if (lowerValue === 'false') {
            app.set('trust proxy', false)
        } else {
            const numericValue = Number(trustProxyValue)
            app.set('trust proxy', Number.isNaN(numericValue) ? trustProxyValue : numericValue)
        }
    }

    app.use(express.json())
    app.use(bodyParser.urlencoded({ extended: true }))

    app.use(cookieParser())

    const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:4040', 'https://zapshipr.com']
    const envOrigins = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    const frontendUrl = process.env.FRONTEND_URL?.trim()
    const allowedOrigins = new Set<string>([
        ...defaultOrigins,
        ...envOrigins,
        ...(frontendUrl ? [frontendUrl] : []),
    ])

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.has(origin)) {
                    callback(null, true)
                    return
                }
                callback(new Error('Not allowed by CORS'))
            },
            credentials: true,
        })
    )

    return app
}
