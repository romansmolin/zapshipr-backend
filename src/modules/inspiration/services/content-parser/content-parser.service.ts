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

    constructor(private readonly logger: ILogger) {}

    /**
     * Parse URL - only YouTube videos are supported
     */
    async parseUrl(url: string): Promise<ParsedContent> {
        const videoId = this.extractYouTubeVideoId(url)

        if (!videoId) {
            throw new AppError({
                errorMessageCode: ErrorMessageCode.VALIDATION_ERROR,
                message: 'Only YouTube links are supported',
                httpCode: 400,
            })
        }

        return this.extractYouTubeVideoDetails(videoId, url)
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
        content = content.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim()

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

    /**
     * Extract full YouTube video details including description
     */
    private async extractYouTubeVideoDetails(videoId: string, url: string): Promise<ParsedContent> {
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

        // Try to get detailed info via YouTube Data API
        const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY

        if (apiKey) {
            this.logger.debug('WE ARE ABOUT TO USE YOUTUBE')

            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`

                const response = await axios.get(apiUrl, { timeout: this.TIMEOUT })
                const video = response.data.items?.[0]

                if (video) {
                    const snippet = video.snippet
                    const stats = video.statistics || {}
                    const duration = video.contentDetails?.duration || ''

                    // Build rich content from video details
                    const content = this.buildYouTubeContent({
                        title: snippet.title,
                        description: snippet.description || '',
                        channelTitle: snippet.channelTitle,
                        tags: snippet.tags || [],
                        viewCount: stats.viewCount,
                        likeCount: stats.likeCount,
                        duration,
                        publishedAt: snippet.publishedAt,
                    })

                    this.logger.info('Extracted YouTube video details via API', {
                        operation: 'ContentParserService.extractYouTubeVideoDetails',
                        videoId,
                        title: snippet.title,
                        descriptionLength: snippet.description?.length || 0,
                        hasTags: (snippet.tags || []).length > 0,
                    })

                    return {
                        title: snippet.title,
                        description: snippet.description?.substring(0, 1000) || '',
                        content,
                        author: snippet.channelTitle,
                        domain: 'youtube.com',
                        publishedDate: snippet.publishedAt,
                        thumbnailUrl,
                    }
                }
            } catch (error) {
                this.logger.warn('Failed to fetch YouTube API data, falling back to oEmbed', {
                    operation: 'ContentParserService.extractYouTubeVideoDetails',
                    videoId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        // Fallback: Try to scrape YouTube page for description
        try {
            const pageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
                timeout: this.TIMEOUT,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            })

            const html = pageResponse.data
            const $ = cheerio.load(html)

            // Extract description from meta tags
            const description =
                $('meta[name="description"]').attr('content') ||
                $('meta[property="og:description"]').attr('content') ||
                ''

            const title =
                $('meta[property="og:title"]').attr('content') ||
                $('meta[name="title"]').attr('content') ||
                $('title').text().replace(' - YouTube', '') ||
                ''

            const author =
                $('link[itemprop="name"]').attr('content') ||
                $('span[itemprop="author"] link[itemprop="name"]').attr('content') ||
                ''

            // Try to extract more data from JSON-LD
            let fullDescription = description
            try {
                const scriptTags = $('script[type="application/ld+json"]').toArray()
                for (const script of scriptTags) {
                    const jsonText = $(script).html()
                    if (jsonText) {
                        const jsonData = JSON.parse(jsonText)
                        if (jsonData.description && jsonData.description.length > fullDescription.length) {
                            fullDescription = jsonData.description
                        }
                    }
                }
            } catch {
                // Ignore JSON parsing errors
            }

            const content = `YouTube Video: ${title}
Channel: ${author}

Description:
${fullDescription}

---
Analyze this video content and extract key insights, main topics, and actionable takeaways.`

            this.logger.info('Extracted YouTube metadata via page scraping', {
                operation: 'ContentParserService.extractYouTubeVideoDetails',
                videoId,
                title,
                descriptionLength: fullDescription.length,
            })

            return {
                title: title.substring(0, 500),
                description: fullDescription.substring(0, 1000),
                content: this.normalizeContent(content),
                author,
                domain: 'youtube.com',
                thumbnailUrl,
            }
        } catch (error) {
            this.logger.warn('Failed to scrape YouTube page, using basic oEmbed', {
                operation: 'ContentParserService.extractYouTubeVideoDetails',
                videoId,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }

        // Final fallback: oEmbed (basic info only)
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const response = await axios.get(oembedUrl, { timeout: this.TIMEOUT })
        const data = response.data

        return {
            title: data.title,
            description: '',
            content: `YouTube Video: ${data.title}\nAuthor: ${data.author_name}\n\nNote: Limited metadata available. For better analysis, provide YOUTUBE_API_KEY.`,
            author: data.author_name,
            domain: 'youtube.com',
            thumbnailUrl,
        }
    }

    /**
     * Build rich content string from YouTube video data
     */
    private buildYouTubeContent(data: {
        title: string
        description: string
        channelTitle: string
        tags: string[]
        viewCount?: string
        likeCount?: string
        duration?: string
        publishedAt?: string
    }): string {
        let content = `YouTube Video: ${data.title}
Channel: ${data.channelTitle}
`

        if (data.viewCount) {
            content += `Views: ${parseInt(data.viewCount).toLocaleString()}\n`
        }

        if (data.likeCount) {
            content += `Likes: ${parseInt(data.likeCount).toLocaleString()}\n`
        }

        if (data.duration) {
            content += `Duration: ${this.formatDuration(data.duration)}\n`
        }

        if (data.publishedAt) {
            content += `Published: ${new Date(data.publishedAt).toLocaleDateString()}\n`
        }

        if (data.tags.length > 0) {
            content += `\nTags: ${data.tags.slice(0, 15).join(', ')}\n`
        }

        content += `\n=== VIDEO DESCRIPTION ===\n${data.description}\n`

        content += `\n=== ANALYSIS INSTRUCTIONS ===
Based on the video title, description, and metadata above:
1. Identify the main topic and key points the video covers
2. Extract actionable insights and takeaways
3. Note any frameworks, strategies, or methods mentioned
4. Consider the target audience and what value they get
5. Generate specific post ideas based on this content`

        return content
    }

    /**
     * Format ISO 8601 duration (PT1H2M3S) to readable format
     */
    private formatDuration(isoDuration: string): string {
        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        if (!match) return isoDuration

        const hours = match[1] ? `${match[1]}h ` : ''
        const minutes = match[2] ? `${match[2]}m ` : ''
        const seconds = match[3] ? `${match[3]}s` : ''

        return `${hours}${minutes}${seconds}`.trim() || '0s'
    }

    /**
     * Extract YouTube video ID from URL
     */
    private extractYouTubeVideoId(url: string): string | null {
        const patterns = [
            /youtube\.com\/watch\?v=([^&]+)/i,
            /youtu\.be\/([^?]+)/i,
            /youtube\.com\/embed\/([^?]+)/i,
            /youtube\.com\/shorts\/([^?]+)/i,
        ]

        for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match) return match[1]
        }

        return null
    }
}
