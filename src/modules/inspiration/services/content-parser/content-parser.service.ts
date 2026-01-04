import * as cheerio from 'cheerio'
import * as pdfParseModule from 'pdf-parse'
import * as mammoth from 'mammoth'
import axios from 'axios'
import type { ILogger } from '@/shared/logger/logger.interface'
import type { IContentParserService, ParsedContent } from './content-parser-service.interface'
import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'

// @ts-ignore - pdf-parse doesn't have proper types
const pdfParse = pdfParseModule.default || pdfParseModule

export class ContentParserService implements IContentParserService {
    private readonly TIMEOUT = 30000 // 30 seconds
    private readonly MAX_CONTENT_LENGTH = -1 // Без ограничения размера HTML

    constructor(private readonly logger: ILogger) {}

    async parseUrl(url: string): Promise<ParsedContent> {
        const parsedUrl = new URL(url)

        // Проверяем, является ли это YouTube/Vimeo видео
        if (this.isVideoUrl(url)) {
            return this.extractVideoMetadata(url)
        }

        const response = await axios.get(url, {
            timeout: this.TIMEOUT,
            maxContentLength: this.MAX_CONTENT_LENGTH,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        })

        const html = response.data
        const $ = cheerio.load(html)

        // Удаляем ненужные элементы
        $('script, style, nav, footer, header, aside, iframe, noscript').remove()

        // Извлекаем метаданные
        const title =
            $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text() ||
            ''

        const description =
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="twitter:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            ''

        const author =
            $('meta[name="author"]').attr('content') ||
            $('meta[property="article:author"]').attr('content') ||
            ''

        const publishedDate =
            $('meta[property="article:published_time"]').attr('content') ||
            $('meta[name="publish_date"]').attr('content') ||
            ''

        // Извлекаем превью изображение
        const thumbnailUrl =
            $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            ''

        // Извлекаем основной текст
        let content = ''

        // Пробуем найти основной контент
        const mainContentSelectors = [
            'article',
            '[role="main"]',
            '.post-content',
            '.article-content',
            '.entry-content',
            'main',
            '.content',
        ]

        for (const selector of mainContentSelectors) {
            const element = $(selector)
            if (element.length) {
                content = element.text()
                break
            }
        }

        // Если не нашли основной контент, берем body
        if (!content) {
            content = $('body').text()
        }

        // Очищаем текст от лишних пробелов и переносов
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim()

        this.logger.info('Parsed URL successfully', {
            operation: 'ContentParserService.parseUrl',
            url: parsedUrl.hostname,
            titleLength: title.length,
            contentLength: content.length,
        })

        return {
            title: title.substring(0, 500),
            description: description.substring(0, 1000),
            content: this.normalizeContent(content),
            author,
            domain: parsedUrl.hostname,
            publishedDate,
            thumbnailUrl: thumbnailUrl || undefined,
        }
    }

    async parseDocument(fileBuffer: Buffer, fileName: string): Promise<ParsedContent> {
        const extension = fileName.split('.').pop()?.toLowerCase()

        let content = ''
        let title = fileName

        if (extension === 'pdf') {
            // Парсинг PDF
            const pdfData = await pdfParse(fileBuffer)
            content = pdfData.text
            title = pdfData.info?.Title || fileName
        } else if (extension === 'docx') {
            // Парсинг DOCX
            const result = await mammoth.extractRawText({ buffer: fileBuffer })
            content = result.value
        } else if (extension === 'txt' || extension === 'md') {
            // Парсинг TXT/MD
            content = fileBuffer.toString('utf-8')
        } else {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'Unsupported document type. Supported: PDF, DOCX, TXT, MD',
                httpCode: 415,
            })
        }

        // Очищаем текст
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim()

        this.logger.info('Parsed document successfully', {
            operation: 'ContentParserService.parseDocument',
            fileName,
            fileType: extension,
            contentLength: content.length,
        })

        return {
            title: title.substring(0, 500),
            content: this.normalizeContent(content),
        }
    }

    async extractVideoMetadata(url: string): Promise<ParsedContent> {
        const videoId = this.extractVideoId(url)

        if (!videoId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'Could not extract video ID from URL',
                httpCode: 400,
            })
        }

        // Для YouTube используем oEmbed API
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`

            const response = await axios.get(oembedUrl, {
                timeout: this.TIMEOUT,
            })

            const data = response.data

            // YouTube thumbnail: используем высококачественный вариант
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

            this.logger.info('Extracted YouTube metadata', {
                operation: 'ContentParserService.extractVideoMetadata',
                videoId,
                title: data.title,
                thumbnailUrl,
            })

            return {
                title: data.title,
                description: '',
                content: `YouTube Video: ${data.title}\nAuthor: ${data.author_name}`,
                author: data.author_name,
                domain: 'youtube.com',
                thumbnailUrl,
            }
        }

        // Для Vimeo используем oEmbed API
        if (url.includes('vimeo.com')) {
            const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`

            const response = await axios.get(oembedUrl, {
                timeout: this.TIMEOUT,
            })

            const data = response.data

            // Vimeo возвращает thumbnail_url в oEmbed ответе
            const thumbnailUrl = data.thumbnail_url || null

            this.logger.info('Extracted Vimeo metadata', {
                operation: 'ContentParserService.extractVideoMetadata',
                videoId,
                title: data.title,
                thumbnailUrl,
            })

            return {
                title: data.title,
                description: data.description || '',
                content: `Vimeo Video: ${data.title}\nAuthor: ${data.author_name}`,
                author: data.author_name,
                domain: 'vimeo.com',
                thumbnailUrl,
            }
        }

        throw new AppError({
            errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
            message: 'Unsupported video platform. Supported: YouTube, Vimeo',
            httpCode: 400,
        })
    }

    normalizeContent(content: string, maxWords: number = 1500): string {
        if (!content) return ''

        // Разбиваем на слова
        const words = content.split(/\s+/)

        // Обрезаем до maxWords
        if (words.length > maxWords) {
            return words.slice(0, maxWords).join(' ') + '...'
        }

        return content
    }

    private isVideoUrl(url: string): boolean {
        const videoPatterns = [
            /youtube\.com\/watch/i,
            /youtu\.be\//i,
            /youtube\.com\/embed/i,
            /vimeo\.com\/\d+/i,
        ]

        return videoPatterns.some((pattern) => pattern.test(url))
    }

    private extractVideoId(url: string): string | null {
        // YouTube
        const youtubePatterns = [
            /youtube\.com\/watch\?v=([^&]+)/i,
            /youtu\.be\/([^?]+)/i,
            /youtube\.com\/embed\/([^?]+)/i,
        ]

        for (const pattern of youtubePatterns) {
            const match = url.match(pattern)
            if (match) return match[1]
        }

        // Vimeo
        const vimeoPattern = /vimeo\.com\/(\d+)/i
        const vimeoMatch = url.match(vimeoPattern)
        if (vimeoMatch) return vimeoMatch[1]

        return null
    }
}
