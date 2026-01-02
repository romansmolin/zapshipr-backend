import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import type { ILogger } from '@/shared/logger/logger.interface'

export class SocialMediaErrorHandler {
    private readonly logger: ILogger

    constructor(logger: ILogger) {
        this.logger = logger
    }

    async handleSocialMediaError(
        error: unknown,
        platform: string,
        userId: string,
        postId: string,
        socialAccountId: string
    ): Promise<{ error: BaseAppError }> {
        const message = error instanceof Error ? error.message : 'Unknown error'

        this.logger.error('Social media operation failed', {
            operation: 'handleSocialMediaError',
            platform,
            userId,
            postId,
            socialAccountId,
            error: {
                name: error instanceof Error ? error.name : 'UnknownError',
                message,
                stack: error instanceof Error ? error.stack : undefined,
            },
        })

        if (error instanceof BaseAppError) {
            return { error }
        }

        return { error: new BaseAppError(message, ErrorCode.UNKNOWN_ERROR, 500) }
    }
}
