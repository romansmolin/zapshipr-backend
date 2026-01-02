import type { WaitlistStatus } from './waitlist.types'

export class WaitlistEntry {
    id: string
    email: string
    emailNormalized: string
    status: WaitlistStatus
    referralCode: string
    referredById: string | null
    referredAt: Date | null
    createdAt: Date
    updatedAt: Date

    constructor(
        id: string,
        email: string,
        emailNormalized: string,
        status: WaitlistStatus,
        referralCode: string,
        referredById: string | null,
        referredAt: Date | null,
        createdAt: Date,
        updatedAt: Date
    ) {
        this.id = id
        this.email = email
        this.emailNormalized = emailNormalized
        this.status = status
        this.referralCode = referralCode
        this.referredById = referredById
        this.referredAt = referredAt
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
