export type WaitlistJoinStatus = 'joined' | 'already_joined'

export interface WaitlistJoinResult {
    status: WaitlistJoinStatus
    referralCode: string
    referralLink: string
    referralCount: number
}

export interface IWaitlistService {
    joinWaitlist(payload: {
        email: string
        referralCode?: string
        referrerWaitlistId?: string
    }): Promise<WaitlistJoinResult>
}
