import { randomUUID } from 'crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'

export interface OAuthStatePayload {
    userId: string
    platform?: string
    codeVerifier?: string
    workspaceId?: string
}

export interface IOAuthStateService {
    create(payload: OAuthStatePayload): string
    consume(state: string): OAuthStatePayload | null
}

export class OAuthStateService implements IOAuthStateService {
    private readonly store = new Map<string, { payload: OAuthStatePayload; expiresAt: number }>()
    private readonly ttlMs: number
    private readonly secret?: string

    constructor(secret?: string, ttlMs: number = 10 * 60 * 1000) {
        this.secret = secret && secret.trim() !== '' ? secret : undefined
        this.ttlMs = ttlMs
    }

    create(payload: OAuthStatePayload): string {
        if (this.secret) {
            return jwt.sign(payload, this.secret, { expiresIn: Math.floor(this.ttlMs / 1000) })
        }

        const state = randomUUID()
        this.store.set(state, { payload, expiresAt: Date.now() + this.ttlMs })
        return state
    }

    consume(state: string): OAuthStatePayload | null {
        if (this.secret) {
            try {
                const payload = jwt.verify(state, this.secret) as JwtPayload | string
                if (typeof payload === 'string') return null
                if (typeof payload.userId !== 'string') return null
                return {
                    userId: payload.userId,
                    platform: typeof payload.platform === 'string' ? payload.platform : undefined,
                    codeVerifier: typeof payload.codeVerifier === 'string' ? payload.codeVerifier : undefined,
                    workspaceId: typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined,
                }
            } catch {
                return null
            }
        }

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
