import { createApp } from './app'
import { db } from './db/client'
import { createAuthRouter } from './modules/auth/routes/auth.routes'
import { createAccountsRouter } from './modules/social/routes/accounts.routes'
import { createPostsRouter } from './modules/post/routes/post.routes'
import { createWaitlistRouter } from './modules/waitlist/routes/waitlist.routes'
import { createUserRoutes } from './modules/user/routes/user.routes'
import { createWorkspaceRouter } from './modules/workspace/routes/workspace.routes'
import { createInspirationsRouter } from './modules/inspiration/routes/inspirations.routes'
import { createErrorHandler } from './shared/http/error-handler'
import { ConsoleLogger } from './shared/logger/console-logger'

const startServer = async () => {
    const app = createApp()

    const logger = new ConsoleLogger()

    const authRoutes = createAuthRouter(logger, db)
    const accountsRoutes = createAccountsRouter(logger, db)
    const postsRoutes = createPostsRouter(logger, db)
    const waitlistRoutes = createWaitlistRouter(logger, db)
    const userRoutes = createUserRoutes(logger, db)
    const workspaceRoutes = createWorkspaceRouter(logger, db)
    const inspirationsRoutes = createInspirationsRouter(logger, db)

    app.use(authRoutes)
    app.use(accountsRoutes)
    app.use(postsRoutes)
    app.use(waitlistRoutes)
    app.use(userRoutes)
    app.use(workspaceRoutes)
    app.use(inspirationsRoutes)

    app.use(createErrorHandler(logger))

    const port = process.env.PORT || 4000

    app.listen(port, () => {
        logger.info(`API server is running on port ${port}`)
    })
}

startServer().catch((error) => {
    console.error('Failed to start server:', error)
    process.exit(1)
})
