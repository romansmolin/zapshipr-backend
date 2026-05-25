import { db } from '@/db/client'
import { buildAppDeps } from '@/composition-root'
import { ConsoleLogger } from '@/shared/logger/console-logger'
import { initializeWorkers } from '@/workers/workers.config'

async function startWorkers() {
    const logger = new ConsoleLogger()
    const deps = buildAppDeps({ db, logger })

    await initializeWorkers(
        logger,
        db,
        deps.socialMediaPostSender,
        deps.socialMediaTokenRefresher,
        deps.postsService
    )

    logger.info('BullMQ workers started successfully')
}

startWorkers().catch((error) => {
    console.error('Failed to start workers:', error)
    process.exit(1)
})
