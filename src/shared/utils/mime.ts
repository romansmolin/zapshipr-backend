const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
}

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
}

export const getFileExtensionFromMimeType = (contentType: string): string | null => {
    return EXTENSION_BY_MIME_TYPE[contentType] ?? null
}

export const sanitizeExtension = (value?: string | null): string | null => {
    if (!value) return null
    const normalized = value.trim().toLowerCase().replace(/^\./, '')
    if (!normalized) return null
    if (!/^[a-z0-9]{1,10}$/.test(normalized)) return null
    return normalized
}

export const resolveExtension = (mimeType: string, extension?: string | null): string => {
    const sanitized = sanitizeExtension(extension)
    if (sanitized) return sanitized
    return getFileExtensionFromMimeType(mimeType) ?? 'bin'
}

/**
 * Extracts the file extension or MIME type from a URL based on its path extension.
 * Returns null if the URL has no extension. When `returnMimeType` is true, falls
 * back to `application/octet-stream` for unknown extensions.
 */
export const getFileMimeTypeFromURL = (url: string, returnMimeType = false): string | null => {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.toLowerCase()

    if (!ext) return null
    if (!returnMimeType) return ext

    return MIME_TYPE_BY_EXTENSION[ext] || 'application/octet-stream'
}
