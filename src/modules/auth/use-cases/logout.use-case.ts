import type { ILogger } from '@/shared/logger/logger.interface'

export type LogoutDeps = {
    logger: ILogger
}

export const logout = async ({ logger }: LogoutDeps): Promise<void> => {
    logger.info('User logged out', { operation: 'logout' })
}
