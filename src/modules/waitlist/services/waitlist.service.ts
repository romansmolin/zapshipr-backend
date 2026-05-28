import type { ILogger } from '@/shared/logger/logger.interface'
import type { IEmailService } from '@/modules/email/services/email.service.interface'
import type { IWaitlistRepository } from '@/modules/waitlist/repositories/waitlist.repository.interface'

import { joinWaitlist as joinWaitlistUseCase } from '@/modules/waitlist/use-cases/join-waitlist.use-case'

import type { IWaitlistService, WaitlistJoinResult } from './waitlist.service.interface'

type WaitlistDeps = {
    waitlist: IWaitlistRepository
    emailService: IEmailService
    logger: ILogger
}

export class WaitlistService implements IWaitlistService {
    private readonly deps: WaitlistDeps

    constructor(waitlistRepository: IWaitlistRepository, emailService: IEmailService, logger: ILogger) {
        this.deps = { waitlist: waitlistRepository, emailService, logger }
    }

    joinWaitlist(payload: {
        email: string
        referralCode?: string
        referrerWaitlistId?: string
    }): Promise<WaitlistJoinResult> {
        return joinWaitlistUseCase(this.deps, payload)
    }
}
