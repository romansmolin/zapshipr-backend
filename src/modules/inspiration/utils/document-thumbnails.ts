import { PDFParse } from 'pdf-parse'
import sharp from 'sharp'

export type ThumbnailResult = {
    buffer: Buffer
    contentType: string
    extension: 'webp'
    width: number
    height: number
}

type TextThumbnailOptions = {
    title?: string
    width?: number
    height?: number
}

const DEFAULT_PDF_MAX_DIMENSION = 512
const DEFAULT_TEXT_WIDTH = 512
const DEFAULT_TEXT_HEIGHT = 640
const DEFAULT_SVG_DENSITY = 72
const DEFAULT_WEBP_QUALITY = 82

export const getThumbnailFromPdf = async (
    pdfBuffer: Buffer,
    options?: { maxDimension?: number; density?: number; title?: string }
): Promise<ThumbnailResult> => {
    const maxDimension = options?.maxDimension ?? DEFAULT_PDF_MAX_DIMENSION
    const density = options?.density ?? 1

    const parser = new PDFParse({ data: pdfBuffer })
    try {
        const screenshot = await parser.getScreenshot({
            first: 1,
            scale: density,
            imageDataUrl: false,
            imageBuffer: true,
        })
        const page = screenshot.pages[0]

        if (!page?.data) {
            throw new Error('PDF screenshot generation failed')
        }

        const image = sharp(Buffer.from(page.data))
        const resized = image.resize({
            width: maxDimension,
            height: maxDimension,
            fit: 'inside',
            withoutEnlargement: true,
        })

        const buffer = await resized
            .flatten({ background: '#ffffff' })
            .webp({ quality: DEFAULT_WEBP_QUALITY })
            .toBuffer()
        const metadata = await sharp(buffer).metadata()

        return {
            buffer,
            contentType: 'image/webp',
            extension: 'webp',
            width: metadata.width ?? 0,
            height: metadata.height ?? 0,
        }
    } catch {
        return createTextThumbnail('', {
            title: options?.title ?? 'PDF Preview',
            width: maxDimension,
            height: maxDimension,
            label: 'PDF',
        })
    } finally {
        await parser.destroy()
    }
}

export const getThumbnailFromMarkdown = async (
    content: string,
    options?: TextThumbnailOptions
): Promise<ThumbnailResult> => {
    const stripped = stripMarkdown(content)
    return createTextThumbnail(stripped, { ...options, label: 'MD' })
}

export const getThumbnailFromTxt = async (
    content: string,
    options?: TextThumbnailOptions
): Promise<ThumbnailResult> => {
    return createTextThumbnail(content, { ...options, label: 'TXT' })
}

const createTextThumbnail = async (
    content: string,
    options: TextThumbnailOptions & { label: string }
): Promise<ThumbnailResult> => {
    const width = options.width ?? DEFAULT_TEXT_WIDTH
    const height = options.height ?? DEFAULT_TEXT_HEIGHT
    const title = normalizeTitle(options.title)
    const normalizedText = normalizeText(content)
    const { lines, truncated } = buildPreviewLines(normalizedText, width, height)

    const svg = buildTextPreviewSvg({
        width,
        height,
        title,
        label: options.label,
        lines,
        truncated,
    })

    const buffer = await sharp(Buffer.from(svg), { density: DEFAULT_SVG_DENSITY })
        .webp({ quality: DEFAULT_WEBP_QUALITY })
        .toBuffer()
    const metadata = await sharp(buffer).metadata()

    return {
        buffer,
        contentType: 'image/webp',
        extension: 'webp',
        width: metadata.width ?? width,
        height: metadata.height ?? height,
    }
}

const stripMarkdown = (content: string): string => {
    return content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^>\s?/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/[*_~]/g, '')
}

const normalizeText = (content: string): string => {
    const normalized = content.replace(/\r\n/g, '\n').replace(/\t/g, '    ').trim()
    if (!normalized) return ''

    return normalized.replace(/[ ]{2,}/g, ' ')
}

const normalizeTitle = (title?: string): string => {
    if (!title) return 'Document Preview'

    const trimmed = title.replace(/\.[^/.]+$/, '').trim()
    if (!trimmed) return 'Document Preview'

    return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed
}

const buildPreviewLines = (
    content: string,
    width: number,
    height: number
): { lines: string[]; truncated: boolean } => {
    const maxCharsPerLine = Math.max(24, Math.floor((width - 120) / 9))
    const lineHeight = 22
    const startY = 130
    const bottomPadding = 40
    const maxLines = Math.max(1, Math.floor((height - startY - bottomPadding) / lineHeight))

    if (!content) {
        return { lines: ['No content available'], truncated: false }
    }

    const inputLines = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

    const wrappedLines: string[] = []
    for (const line of inputLines) {
        const words = line.split(/\s+/)
        let current = ''
        for (const word of words) {
            const next = current ? `${current} ${word}` : word
            if (next.length > maxCharsPerLine) {
                if (current) {
                    wrappedLines.push(current)
                }
                current = word
            } else {
                current = next
            }
        }
        if (current) {
            wrappedLines.push(current)
        }
    }

    if (wrappedLines.length === 0) {
        return { lines: ['No content available'], truncated: false }
    }

    if (wrappedLines.length <= maxLines) {
        return { lines: wrappedLines, truncated: false }
    }

    const lines = wrappedLines.slice(0, maxLines)
    const lastIndex = lines.length - 1
    lines[lastIndex] = `${lines[lastIndex].replace(/\.*$/, '')}...`

    return { lines, truncated: true }
}

const buildTextPreviewSvg = (options: {
    width: number
    height: number
    title: string
    label: string
    lines: string[]
    truncated: boolean
}): string => {
    const { width, height, title, label, lines } = options
    const pageMargin = 24
    const contentX = pageMargin + 20
    const titleY = pageMargin + 44
    const labelY = pageMargin + 44
    const dividerY = pageMargin + 70
    const startY = pageMargin + 106
    const lineHeight = 22

    const textLines = lines
        .map((line, index) => {
            const y = startY + index * lineHeight
            return `<text x="${contentX}" y="${y}" font-size="16" fill="#2b2b2b">${escapeXml(line)}</text>`
        })
        .join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#f4f4f5"/>
  <rect x="${pageMargin}" y="${pageMargin}" width="${width - pageMargin * 2}" height="${
      height - pageMargin * 2
  }" rx="16" fill="#ffffff" stroke="#e2e2e2" />
  <text x="${contentX}" y="${titleY}" font-size="20" font-weight="600" fill="#111827">${escapeXml(title)}</text>
  <text x="${width - pageMargin - 36}" y="${labelY}" font-size="12" fill="#6b7280" text-anchor="end">${escapeXml(
      label
  )}</text>
  <line x1="${contentX}" y1="${dividerY}" x2="${
      width - pageMargin - 20
  }" y2="${dividerY}" stroke="#e5e7eb" stroke-width="1" />
  ${textLines}
</svg>`
}

const escapeXml = (value: string): string => {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}
