import type { PinterestBoardPrivacy } from './social-account.schema'

export class PinterestBoard {
    id: string
    userId: string
    socialAccountId: string
    pinterestBoardId: string
    name: string
    description?: string | null
    ownerUsername?: string | null
    thumbnailUrl?: string | null
    privacy: PinterestBoardPrivacy
    createdAt: Date
    updatedAt: Date

    constructor(
        id: string,
        userId: string,
        socialAccountId: string,
        pinterestBoardId: string,
        name: string,
        description: string | null,
        ownerUsername: string | null,
        thumbnailUrl: string | null,
        privacy: PinterestBoardPrivacy,
        createdAt: Date,
        updatedAt: Date
    ) {
        this.id = id
        this.userId = userId
        this.socialAccountId = socialAccountId
        this.pinterestBoardId = pinterestBoardId
        this.name = name
        this.description = description ?? null
        this.ownerUsername = ownerUsername ?? null
        this.thumbnailUrl = thumbnailUrl ?? null
        this.privacy = privacy
        this.createdAt = createdAt
        this.updatedAt = updatedAt
    }
}
