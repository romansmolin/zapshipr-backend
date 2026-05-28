import { getFileExtensionFromMimeType } from './mime'

const sanitizeBase = (name: string): string =>
    name
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

export const buildSafeFilename = (originalName: string, index: number, fallbackExt?: string): string => {
    const name = decodeURIComponent(originalName || '').trim()
    const hasExt = name.includes('.')
    const safe = sanitizeBase(name)
    const ext = hasExt ? '' : fallbackExt ? `.${fallbackExt}` : ''
    const base = safe || `media${ext}`
    return `${Date.now()}-${index}-${base}`
}

export const buildSafeFilenameFromUrl = (url: string, index: number): string => {
    try {
        const pathname = new URL(url).pathname
        const decoded = decodeURIComponent(pathname.split('/').pop() || '')
        const base = sanitizeBase(decoded)
        if (base) return `${Date.now()}-${index}-${base}`
    } catch (_) {
        // fall through to default
    }
    return `${Date.now()}-${index}-media`
}

export const updateFilenameExtension = (filename: string, contentType: string): string => {
    const extension = getFileExtensionFromMimeType(contentType)
    if (!extension) return filename

    if (filename.includes('.')) {
        return filename.replace(/\.[^.]+$/, `.${extension}`)
    }

    return `${filename}.${extension}`
}
