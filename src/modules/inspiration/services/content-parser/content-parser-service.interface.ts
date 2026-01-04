export interface ParsedContent {
    title?: string
    description?: string
    content: string
    author?: string
    domain?: string
    publishedDate?: string
    thumbnailUrl?: string
}

export interface IContentParserService {
    /**
     * Парсинг веб-страницы
     */
    parseUrl(url: string): Promise<ParsedContent>

    /**
     * Парсинг документа (PDF, TXT, MD, DOCX)
     */
    parseDocument(fileBuffer: Buffer, fileName: string): Promise<ParsedContent>

    /**
     * Извлечение метаданных из YouTube/Vimeo видео
     */
    extractVideoMetadata(url: string): Promise<ParsedContent>

    /**
     * Нормализация контента (обрезка до 1500 слов)
     */
    normalizeContent(content: string, maxWords?: number): string
}

