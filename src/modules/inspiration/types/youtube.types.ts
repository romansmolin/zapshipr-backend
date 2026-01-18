/**
 * Canonical representation of a YouTube video reference.
 * All YouTube URL formats are normalized to this structure.
 */
export interface CanonicalVideoRef {
    /** Provider identifier */
    provider: 'youtube'

    /** YouTube video ID (11 characters) */
    videoId: string

    /** Start timestamp in seconds (from t= or start= parameter) */
    startSec: number | null

    /** End timestamp in seconds (from end= parameter, rare) */
    endSec: number | null

    /** Whether the original URL was a Shorts link */
    isShorts: boolean

    /** Playlist ID if present in the URL */
    playlistId: string | null

    /** Original URL as provided by user */
    rawUrl: string

    /** Normalized canonical URL (always https://www.youtube.com/watch?v=...) */
    canonicalUrl: string
}

/**
 * Result of URL normalization attempt
 */
export type NormalizeYouTubeUrlResult =
    | { success: true; ref: CanonicalVideoRef }
    | { success: false; error: string }

