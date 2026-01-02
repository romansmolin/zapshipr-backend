import bodyParser from 'body-parser'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

export const createApp = () => {
    const app = express()

    app.use(express.json())
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())

    app.use(cookieParser())

    const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:4040']

    app.use(
        cors({
            origin: defaultOrigins,
            credentials: true,
        })
    )

    return app
}
