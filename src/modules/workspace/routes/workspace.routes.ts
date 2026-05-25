import type { Router } from 'express'
import { Router as createRouter } from 'express'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import multer from 'multer'

import { schema as dbSchema } from '@/db/schema'
import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'

import { WorkspaceRepository } from '../repositories/workspace.repository'
import { WorkspaceProfileSignalsRepository } from '../repositories/workspace-profile-signals.repository'
import { WorkspaceService } from '../services/workspace.service'
import { WorkspaceProfileService } from '../services/workspace-profile.service'
import { WorkspaceController } from '../controllers/workspace.controller'
import { WorkspaceTagsRepository } from '@/modules/inspiration/repositories/workspace-tags.repository'
import { WorkspaceTagsService } from '@/modules/inspiration/services/workspace-tags/workspace-tags.service'
import { UserRepository } from '@/modules/user/repositories/users.repository'
import { PostsRepository } from '@/modules/post/repositories/posts.repository'
import { AccountRepository } from '@/modules/social/repositories/account.repository'
import { MediaRepository } from '@/modules/media/repositories/media.repository'
import { UserService } from '@/modules/user/services/user.service'

import type { ILogger } from '@/shared/logger/logger.interface'
import type { IMediaUploader } from '@/shared/media-uploader'

export interface WorkspaceModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    mediaUploader: IMediaUploader
}

export interface WorkspaceModule {
    router: Router
}

export const buildWorkspaceModule = ({ db, logger, mediaUploader }: WorkspaceModuleDeps): WorkspaceModule => {
    const router = createRouter()
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
        },
    })

    const repository = new WorkspaceRepository(db, logger)
    const userRepository = new UserRepository(db, logger)
    const postsRepository = new PostsRepository(db, logger)
    const accountRepository = new AccountRepository(db, logger)
    const mediaRepository = new MediaRepository(db, logger)
    const signalsRepository = new WorkspaceProfileSignalsRepository(db, logger)
    const tagsRepository = new WorkspaceTagsRepository(db, logger)
    const tagsService = new WorkspaceTagsService(tagsRepository, logger)
    const userService = new UserService(
        userRepository,
        repository,
        postsRepository,
        accountRepository,
        mediaRepository,
        mediaUploader,
        db,
        logger
    )
    const profileService = new WorkspaceProfileService(repository, signalsRepository, tagsService, logger)
    const service = new WorkspaceService(repository, mediaUploader, profileService, userService, logger)
    const controller = new WorkspaceController(service, tagsService, profileService, logger)
    const handler = bindController(controller)

    router.post('/workspaces', authMiddleware, upload.single('avatar'), handler('create'))
    router.get('/workspaces', authMiddleware, handler('getAll'))
    router.get('/workspaces/default', authMiddleware, handler('getDefault'))
    router.get('/workspaces/:id', authMiddleware, handler('getById'))
    router.put('/workspaces/:id', authMiddleware, upload.single('avatar'), handler('update'))
    router.put('/workspaces/:id/default', authMiddleware, handler('setAsDefault'))
    router.delete('/workspaces/:id', authMiddleware, handler('delete'))

    // Main Prompt endpoints
    router.get('/workspaces/:id/prompt', authMiddleware, handler('getMainPrompt'))
    router.put('/workspaces/:id/prompt', authMiddleware, handler('updateMainPrompt'))

    // Onboarding endpoints
    router.get('/workspaces/:id/onboarding', authMiddleware, handler('getOnboarding'))
    router.put('/workspaces/:id/onboarding', authMiddleware, handler('updateOnboarding'))

    // AI Context endpoint
    router.get('/workspaces/:id/ai-context', authMiddleware, handler('getAIContext'))

    // Tags endpoints
    router.get('/workspaces/:id/tags', authMiddleware, handler('getTags'))
    router.post('/workspaces/:id/tags', authMiddleware, handler('createTag'))
    router.put('/workspaces/:id/tags/:tagId', authMiddleware, handler('updateTag'))
    router.delete('/workspaces/:id/tags/:tagId', authMiddleware, handler('deleteTag'))

    return { router }
}
