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
import { AiService } from './modules/ai/services/ai.service'
import { AxiosHttpClient } from './shared/http-client'
import { createErrorHandler } from './shared/http/error-handler'
import { ConsoleLogger } from './shared/logger/console-logger'

const startServer = async () => {
    const app = createApp()
    const logger = new ConsoleLogger()

    // Composition root — every shared singleton constructed once here.
    const deps = buildAppDeps({ db, logger })

    // AI service has its own OpenAI-targeted http client and consumes cross-cutting services.
    const openaiApiClient = new AxiosHttpClient('https://api.openai.com/v1')
    const aiService = new AiService(openaiApiClient, logger, deps.userService, deps.workspaceProfileService)

    // Build modules. Post module now takes the fully-wired postsService from deps.
    const { router: authRoutes } = buildAuthModule({ db, logger, emailService: deps.emailService })
    const { router: accountsRoutes } = buildAccountsModule({
        db,
        logger,
        mediaUploader: deps.mediaUploader,
        apiClient: deps.apiClient,
    })
    const { router: postsRoutes } = buildPostsModule({ db, logger, postsService: deps.postsService })
    const { router: waitlistRoutes } = buildWaitlistModule({ db, logger, emailService: deps.emailService })
    const { router: userRoutes } = buildUserModule({ db, logger, mediaUploader: deps.mediaUploader })
    const { router: workspaceRoutes } = buildWorkspaceModule({ db, logger, mediaUploader: deps.mediaUploader })
    const { router: inspirationsRoutes } = buildInspirationsModule({
        db,
        logger,
        mediaUploader: deps.mediaUploader,
    })
    const { router: workspaceTagsRoutes } = buildWorkspaceTagsModule({ db, logger })
    const { router: mediaRoutes } = buildMediaModule({ db, logger, mediaUploader: deps.mediaUploader })
    const { router: billingRoutes } = buildBillingModule({ db, logger })
    const { router: aiRoutes } = buildAiModule({ logger, aiService })

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
