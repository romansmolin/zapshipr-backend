import { createApp } from './app'
import { db } from './db/client'
import { buildAppDeps } from './composition-root'
import { buildAuthModule } from './modules/auth/routes/auth.routes'
import { buildAccountsModule } from './modules/social/routes/accounts.routes'
import { buildPostsModule } from './modules/post/routes/post.routes'
import { buildWaitlistModule } from './modules/waitlist/routes/waitlist.routes'
import { buildUserModule } from './modules/user/routes/user.routes'
import { buildWorkspaceModule } from './modules/workspace/routes/workspace.routes'
import { buildInspirationsModule } from './modules/inspiration/routes/inspirations.routes'
import { buildWorkspaceTagsModule } from './modules/inspiration/routes/workspace-tags.routes'
import { buildMediaModule } from './modules/media/routes/media.routes'
import { buildBillingModule } from './modules/billing/routes/billing.routes'
import { buildAiModule } from './modules/ai/routes/ai.routes'
import { createErrorHandler } from './shared/http/error-handler'
import { ConsoleLogger } from './shared/logger/console-logger'

const startServer = async () => {
    const app = createApp()
    const logger = new ConsoleLogger()

    // Composition root — every shared singleton constructed once here.
    const deps = buildAppDeps({ db, logger })

    const { router: authRoutes } = buildAuthModule({ logger, authService: deps.authService })

    const { router: accountsRoutes } = buildAccountsModule({
        db,
        logger,
        accountsService: deps.accountsService,
        socialMediaConnectorService: deps.socialMediaConnectorService,
        oauthStateService: deps.oauthStateService,
    })

    const { router: postsRoutes } = buildPostsModule({
        db,
        logger,
        postsService: deps.postsService,
        userService: deps.userService,
        workspaceProfileService: deps.workspaceProfileService,
    })

    const { router: waitlistRoutes } = buildWaitlistModule({ logger, waitlistService: deps.waitlistService })

    const { router: userRoutes } = buildUserModule({ logger, userService: deps.userService })

    const { router: workspaceRoutes } = buildWorkspaceModule({
        logger,
        workspaceService: deps.workspaceService,
        workspaceProfileService: deps.workspaceProfileService,
        workspaceTagsService: deps.workspaceTagsService,
    })

    const { router: inspirationsRoutes } = buildInspirationsModule({
        db,
        logger,
        inspirationsService: deps.inspirationsService,
    })

    const { router: workspaceTagsRoutes } = buildWorkspaceTagsModule({
        logger,
        workspaceTagsService: deps.workspaceTagsService,
    })

    const { router: mediaRoutes } = buildMediaModule({ logger, mediaService: deps.mediaService })

    const { router: billingRoutes } = buildBillingModule({ logger, billingService: deps.billingService })

    const { router: aiRoutes } = buildAiModule({ logger, aiService: deps.aiService })

    app.use(authRoutes)
    app.use(accountsRoutes)
    app.use(postsRoutes)
    app.use(aiRoutes)

    app.use(waitlistRoutes)
    app.use(userRoutes)
    app.use(workspaceRoutes)

    app.use(inspirationsRoutes)
    app.use(workspaceTagsRoutes)

    app.use(mediaRoutes)
    app.use(billingRoutes)

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
