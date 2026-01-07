import type { CanonicalVideoRef, NormalizeYouTubeUrlResult } from '../types/youtube.types'

/**
 * Marketing and tracking parameters to ignore when normalizing URLs
 */
const IGNORED_PARAMS = new Set([
    'pp',
    'si',
    'feature',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'ref',
    'source',
    'mc_cid',
    'mc_eid',
    'fbclid',
    'gclid',
    'ab_channel',
])

/**
 * Parse timestamp string to seconds.
 * Supports formats:
 * - Plain number: "90" → 90
 * - With 's' suffix: "90s" → 90
 * - HMS format: "1h2m3s" → 3723
 * - Partial HMS: "2m30s" → 150, "1h" → 3600
 */
export function parseTimestamp(timestamp: string | null): number | null {
    if (!timestamp) return null

    const trimmed = timestamp.trim()
    if (!trimmed) return null

    // Try HMS format first: 1h2m3s, 2m30s, 1h, etc.
    const hmsMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i)
    if (hmsMatch) {
        const hours = parseInt(hmsMatch[1] || '0', 10)
        const minutes = parseInt(hmsMatch[2] || '0', 10)
        const seconds = parseInt(hmsMatch[3] || '0', 10)

        // At least one component must be present
        if (hours > 0 || minutes > 0 || seconds > 0) {
            return hours * 3600 + minutes * 60 + seconds
        }
    }

    // Try plain number (with optional 's' suffix)
    const plainMatch = trimmed.match(/^(\d+)s?$/i)
    if (plainMatch) {
        const seconds = parseInt(plainMatch[1], 10)
        if (!isNaN(seconds) && seconds >= 0) {
            return seconds
        }
    }

    return null
}

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(url: string, pathname: string, searchParams: URLSearchParams): string | null {
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    const vParam = searchParams.get('v')
    if (vParam && isValidVideoId(vParam)) {
        return vParam
    }

    // Shorts: youtube.com/shorts/VIDEO_ID
    const shortsMatch = pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/)
    if (shortsMatch) {
        return shortsMatch[1]
    }

    // Embed: youtube.com/embed/VIDEO_ID
    const embedMatch = pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/)
    if (embedMatch) {
        return embedMatch[1]
    }

    // Live: youtube.com/live/VIDEO_ID
    const liveMatch = pathname.match(/^\/live\/([a-zA-Z0-9_-]{11})/)
    if (liveMatch) {
        return liveMatch[1]
    }

    // youtu.be short URL: youtu.be/VIDEO_ID
    if (url.includes('youtu.be')) {
        const shortMatch = pathname.match(/^\/([a-zA-Z0-9_-]{11})/)
        if (shortMatch) {
            return shortMatch[1]
        }
    }

    return null
}

/**
 * Validate YouTube video ID format (11 characters, alphanumeric + _ -)
 */
function isValidVideoId(id: string): boolean {
    return /^[a-zA-Z0-9_-]{11}$/.test(id)
}

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        const hostname = parsed.hostname.toLowerCase()
        return (
            hostname === 'youtube.com' ||
            hostname === 'www.youtube.com' ||
            hostname === 'm.youtube.com' ||
            hostname === 'youtu.be' ||
            hostname === 'www.youtu.be'
        )
    } catch {
        return false
    }
}

/**
 * Normalize any YouTube URL to a canonical format.
 *
 * Handles:
 * - youtube.com/watch?v=...
 * - youtu.be/...
 * - youtube.com/shorts/...
 * - youtube.com/embed/...
 * - youtube.com/live/...
 * - Timestamp parameters (t=, start=)
 * - Playlist IDs (list=)
 * - Ignores marketing parameters (utm_*, pp, si, etc.)
 *
 * @param rawUrl - The original YouTube URL
 * @returns Normalized result with CanonicalVideoRef or error
 */
export function normalizeYouTubeUrl(rawUrl: string): NormalizeYouTubeUrlResult {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return { success: false, error: 'URL is required' }
    }

    const trimmedUrl = rawUrl.trim()

    // Parse URL
    let parsed: URL
    try {
        parsed = new URL(trimmedUrl)
    } catch {
        return { success: false, error: 'Invalid URL format' }
    }

    // Check if it's a YouTube URL
    if (!isYouTubeUrl(trimmedUrl)) {
        return { success: false, error: 'Not a YouTube URL' }
    }

    const pathname = parsed.pathname
    const searchParams = parsed.searchParams

    // Extract video ID
    const videoId = extractVideoId(trimmedUrl, pathname, searchParams)
    if (!videoId) {
        return { success: false, error: 'Could not extract video ID from URL' }
    }

    // Check if it's a Shorts URL
    const isShorts = pathname.startsWith('/shorts/')

    // Extract playlist ID (if present)
    const playlistId = searchParams.get('list') || null

    // Extract timestamp
    // Priority: t > start (t is more common)
    const tParam = searchParams.get('t')
    const startParam = searchParams.get('start')
    const startSec = parseTimestamp(tParam) ?? parseTimestamp(startParam)

    // Extract end timestamp (rare, but supported)
    const endParam = searchParams.get('end')
    const endSec = parseTimestamp(endParam)

    // Build canonical URL
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`

    const ref: CanonicalVideoRef = {
        provider: 'youtube',
        videoId,
        startSec,
        endSec,
        isShorts,
        playlistId,
        rawUrl: trimmedUrl,
        canonicalUrl,
    }

    return { success: true, ref }
}

/**
 * Quick helper to extract just the video ID from a YouTube URL.
 * Returns null if URL is invalid or not a YouTube URL.
 */
export function extractYouTubeVideoId(url: string): string | null {
    const result = normalizeYouTubeUrl(url)
    return result.success ? result.ref.videoId : null
}

