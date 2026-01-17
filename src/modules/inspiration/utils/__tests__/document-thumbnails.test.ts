import { readFileSync } from 'fs'
import path from 'path'

import sharp from 'sharp'

import { getThumbnailFromMarkdown, getThumbnailFromPdf, getThumbnailFromTxt } from '../document-thumbnails'

describe('document thumbnail utilities', () => {
    it('generates a PDF thumbnail from the first page', async () => {
        const pdfPath = path.join(process.cwd(), 'test.pdf')
        const pdfBuffer = readFileSync(pdfPath)

        const result = await getThumbnailFromPdf(pdfBuffer)

        expect(result.buffer.length).toBeGreaterThan(0)
        expect(result.contentType).toBe('image/webp')
        expect(result.extension).toBe('webp')
        expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(512)

        const metadata = await sharp(result.buffer).metadata()
        expect(metadata.format).toBe('webp')
        expect(metadata.width).toBeGreaterThan(0)
        expect(metadata.height).toBeGreaterThan(0)
    })

    it('generates a Markdown thumbnail with predictable dimensions', async () => {
        const markdown = `# Heading

This is **bold** text with a [link](https://example.com).

- Bullet one
- Bullet two`

        const result = await getThumbnailFromMarkdown(markdown, { title: 'notes.md' })

        const metadata = await sharp(result.buffer).metadata()
        expect(metadata.format).toBe('webp')
        expect(metadata.width).toBe(512)
        expect(metadata.height).toBe(640)
    })

    it('handles minimal TXT input safely', async () => {
        const result = await getThumbnailFromTxt('', { title: 'empty.txt' })

        expect(result.buffer.length).toBeGreaterThan(0)

        const metadata = await sharp(result.buffer).metadata()
        expect(metadata.format).toBe('webp')
        expect(metadata.width).toBe(512)
        expect(metadata.height).toBe(640)
    })
})
