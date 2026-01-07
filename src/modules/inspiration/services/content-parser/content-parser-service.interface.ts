export interface ParsedContent {
    title?: string
    description?: string
    content: string
    author?: string
    domain?: string
    publishedDate?: string
    thumbnailUrl?: string // YouTube video thumbnail
}

export interface IContentParserService {
    /**
     * Parse YouTube video URL and extract metadata
     * Only YouTube links are supported
     */
    parseUrl(url: string): Promise<ParsedContent>

    /**
     * Parse document (PDF, TXT, MD, DOCX)
     */
    parseDocument(fileBuffer: Buffer, fileName: string): Promise<ParsedContent>

    /**
     * Normalize content (truncate to maxWords)
     */
    normalizeContent(content: string, maxWords?: number): string
}

