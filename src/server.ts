import { createApp } from './app'
import { db } from './db/client'
import { createAuthRouter } from './modules/auth/routes/auth.routes'
import { createAccountsRouter } from './modules/social/routes/accounts.routes'
import { createPostsRouter } from './modules/post/routes/post.routes'
import { createWaitlistRouter } from './modules/waitlist/routes/waitlist.routes'
import { createUserRoutes } from './modules/user/routes/user.routes'
import { createWorkspaceRouter } from './modules/workspace/routes/workspace.routes'
import { createInspirationsRouter } from './modules/inspiration/routes/inspirations.routes'
import { createWorkspaceTagsRouter } from './modules/inspiration/routes/workspace-tags.routes'
import { createMediaRouter } from './modules/media/routes/media.routes'
import { createBillingRouter } from './modules/billing/routes/billing.routes'
import { createAiRouter } from './modules/ai/routes/ai.routes'
import { AiService } from './modules/ai/services/ai.service'
import { AxiosHttpClient } from './shared/http-client'
import { UserRepository } from './modules/user/repositories/users.repository'
import { WorkspaceRepository } from './modules/workspace/repositories/workspace.repository'
import { PostsRepository } from './modules/post/repositories/posts.repository'
import { AccountRepository } from './modules/social/repositories/account.repository'
import { MediaRepository } from './modules/media/repositories/media.repository'
import { S3Uploader } from './shared/media-uploader/media-uploader'
import { UserService } from './modules/user/services/user.service'
import { WorkspaceProfileSignalsRepository } from './modules/workspace/repositories/workspace-profile-signals.repository'
import { WorkspaceTagsRepository } from './modules/inspiration/repositories/workspace-tags.repository'
import { WorkspaceTagsService } from './modules/inspiration/services/workspace-tags/workspace-tags.service'
import { WorkspaceProfileService } from './modules/workspace/services/workspace-profile.service'
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
    const workspaceTagsRoutes = createWorkspaceTagsRouter(logger, db)
    const mediaRoutes = createMediaRouter(logger, db)
    const billingRoutes = createBillingRouter(logger, db)

    const userRepository = new UserRepository(db, logger)
    const workspaceRepository = new WorkspaceRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const accountRepository = new AccountRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)
    const mediaUploader = new S3Uploader(logger)
    const userService = new UserService(
        userRepository,
        workspaceRepository,
        postsRepository,
        accountRepository,
        mediaRepository,
        mediaUploader,
        db,
        logger
    )
    const signalsRepository = new WorkspaceProfileSignalsRepository(db, logger)
    const tagsRepository = new WorkspaceTagsRepository(db, logger)
    const tagsService = new WorkspaceTagsService(tagsRepository, logger)
    const workspaceProfileService = new WorkspaceProfileService(workspaceRepository, signalsRepository, tagsService, logger)
    const apiClient = new AxiosHttpClient('https://api.openai.com/v1')
    const aiService = new AiService(apiClient, logger, userService, workspaceProfileService)
    const aiRoutes = createAiRouter(logger, aiService)

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
