import type { SocialPlatform } from './social-account.schema'

export class Account {
    id: string
    userId: string
    workspaceId: string | null
    platform: SocialPlatform
    username: string
    accessToken: string
    connectedAt: Date | null
    pageId: string
    picture?: string | null
    refreshToken?: string | null
    expiresIn?: Date | null
    refreshExpiresIn?: Date | null
    maxVideoPostDurationSec?: number | null
    privacyLevelOptions?: string[] | null

    constructor(
        id: string,
        userId: string,
        workspaceId: string | null,
        platform: SocialPlatform,
        username: string,
        accessToken: string,
        connectedAt: Date | null,
        pageId: string,
        picture?: string | null,
        refreshToken?: string | null,
        expiresIn?: Date | null,
        refreshExpiresIn?: Date | null,
        maxVideoPostDurationSec?: number | null,
        privacyLevelOptions?: string[] | null
    ) {
        this.id = id
        this.userId = userId
        this.workspaceId = workspaceId
        this.platform = platform
        this.username = username
        this.accessToken = accessToken
        this.connectedAt = connectedAt
        this.pageId = pageId
        this.picture = picture ?? null
        this.refreshToken = refreshToken ?? null
        this.expiresIn = expiresIn ?? null
        this.refreshExpiresIn = refreshExpiresIn ?? null
        this.maxVideoPostDurationSec = maxVideoPostDurationSec ?? null
        this.privacyLevelOptions = privacyLevelOptions ?? null
    }

    get tenantId(): string {
        return this.userId
    }

    get connectedDate(): Date | null {
        return this.connectedAt
    }
}
