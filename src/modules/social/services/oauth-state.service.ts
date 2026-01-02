import { randomUUID } from 'crypto'

export interface OAuthStatePayload {
    userId: string
    platform?: string
    codeVerifier?: string
}

export interface IOAuthStateService {
    create(payload: OAuthStatePayload): string
    consume(state: string): OAuthStatePayload | null
}

export class OAuthStateService implements IOAuthStateService {
    private readonly store = new Map<string, { payload: OAuthStatePayload; expiresAt: number }>()
    private readonly ttlMs: number

    constructor(ttlMs: number = 10 * 60 * 1000) {
        this.ttlMs = ttlMs
    }

    create(payload: OAuthStatePayload): string {
        const state = randomUUID()
        this.store.set(state, { payload, expiresAt: Date.now() + this.ttlMs })
        return state
    }

    consume(state: string): OAuthStatePayload | null {
        const entry = this.store.get(state)

        if (!entry) return null

        if (Date.now() > entry.expiresAt) {
            this.store.delete(state)
            return null
        }

        this.store.delete(state)
        return entry.payload
    }
}
