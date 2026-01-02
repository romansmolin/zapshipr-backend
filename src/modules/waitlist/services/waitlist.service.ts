import type { IWaitlistService, WaitlistJoinResult } from './waitlist.service.interface'
import type { JoinWaitlistUseCase } from '@/modules/waitlist/use-cases/join-waitlist.use-case'

export class WaitlistService implements IWaitlistService {
    private readonly joinWaitlistUseCase: JoinWaitlistUseCase

    constructor(joinWaitlistUseCase: JoinWaitlistUseCase) {
        this.joinWaitlistUseCase = joinWaitlistUseCase
    }

    async joinWaitlist(payload: {
        email: string
        referralCode?: string
        referrerWaitlistId?: string
    }): Promise<WaitlistJoinResult> {
        return this.joinWaitlistUseCase.execute(payload)
    }
}
