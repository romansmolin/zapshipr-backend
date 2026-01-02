"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentParserService = void 0;
const cheerio = __importStar(require("cheerio"));
const pdfParseModule = __importStar(require("pdf-parse"));
const mammoth = __importStar(require("mammoth"));
const axios_1 = __importDefault(require("axios"));
const app_error_1 = require("@/shared/errors/app-error");
// @ts-ignore - pdf-parse doesn't have proper types
const pdfParse = pdfParseModule.default || pdfParseModule;
class ContentParserService {
    constructor(logger) {
        this.logger = logger;
        this.TIMEOUT = 30000; // 30 seconds
        this.MAX_CONTENT_LENGTH = 50000; // Макс. размер HTML для парсинга
    }
    async parseUrl(url) {
        const parsedUrl = new URL(url);
        // Проверяем, является ли это YouTube/Vimeo видео
        if (this.isVideoUrl(url)) {
            return this.extractVideoMetadata(url);
        }
        const response = await axios_1.default.get(url, {
            timeout: this.TIMEOUT,
            maxContentLength: this.MAX_CONTENT_LENGTH,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });
        const html = response.data;
        const $ = cheerio.load(html);
        // Удаляем ненужные элементы
        $('script, style, nav, footer, header, aside, iframe, noscript').remove();
        // Извлекаем метаданные
        const title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text() ||
            '';
        const description = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="twitter:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            '';
        const author = $('meta[name="author"]').attr('content') ||
            $('meta[property="article:author"]').attr('content') ||
            '';
        const publishedDate = $('meta[property="article:published_time"]').attr('content') ||
            $('meta[name="publish_date"]').attr('content') ||
            '';
        // Извлекаем основной текст
        let content = '';
        // Пробуем найти основной контент
        const mainContentSelectors = [
            'article',
            '[role="main"]',
            '.post-content',
            '.article-content',
            '.entry-content',
            'main',
            '.content',
        ];
        for (const selector of mainContentSelectors) {
            const element = $(selector);
            if (element.length) {
                content = element.text();
                break;
            }
        }
        // Если не нашли основной контент, берем body
        if (!content) {
            content = $('body').text();
        }
        // Очищаем текст от лишних пробелов и переносов
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
        this.logger.info('Parsed URL successfully', {
            operation: 'ContentParserService.parseUrl',
            url: parsedUrl.hostname,
            titleLength: title.length,
            contentLength: content.length,
        });
        return {
            title: title.substring(0, 500),
            description: description.substring(0, 1000),
            content: this.normalizeContent(content),
            author,
            domain: parsedUrl.hostname,
            publishedDate,
        };
    }
    async parseDocument(fileBuffer, fileName) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        let content = '';
        let title = fileName;
        if (extension === 'pdf') {
            // Парсинг PDF
            const pdfData = await pdfParse(fileBuffer);
            content = pdfData.text;
            title = pdfData.info?.Title || fileName;
        }
        else if (extension === 'docx') {
            // Парсинг DOCX
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            content = result.value;
        }
        else if (extension === 'txt' || extension === 'md') {
            // Парсинг TXT/MD
            content = fileBuffer.toString('utf-8');
        }
        else {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                message: 'Unsupported document type. Supported: PDF, DOCX, TXT, MD',
                httpCode: 415,
            });
        }
        // Очищаем текст
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
        this.logger.info('Parsed document successfully', {
            operation: 'ContentParserService.parseDocument',
            fileName,
            fileType: extension,
            contentLength: content.length,
        });
        return {
            title: title.substring(0, 500),
            content: this.normalizeContent(content),
        };
    }
    async extractVideoMetadata(url) {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                message: 'Could not extract video ID from URL',
                httpCode: 400,
            });
        }
        // Для YouTube используем oEmbed API
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const response = await axios_1.default.get(oembedUrl, {
                timeout: this.TIMEOUT,
            });
            const data = response.data;
            this.logger.info('Extracted YouTube metadata', {
                operation: 'ContentParserService.extractVideoMetadata',
                videoId,
                title: data.title,
            });
            return {
                title: data.title,
                description: '',
                content: `YouTube Video: ${data.title}\nAuthor: ${data.author_name}`,
                author: data.author_name,
                domain: 'youtube.com',
            };
        }
        // Для Vimeo используем oEmbed API
        if (url.includes('vimeo.com')) {
            const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
            const response = await axios_1.default.get(oembedUrl, {
                timeout: this.TIMEOUT,
            });
            const data = response.data;
            this.logger.info('Extracted Vimeo metadata', {
                operation: 'ContentParserService.extractVideoMetadata',
                videoId,
                title: data.title,
            });
            return {
                title: data.title,
                description: data.description || '',
                content: `Vimeo Video: ${data.title}\nAuthor: ${data.author_name}`,
                author: data.author_name,
                domain: 'vimeo.com',
            };
        }
        throw new app_error_1.AppError({
            errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
            message: 'Unsupported video platform. Supported: YouTube, Vimeo',
            httpCode: 400,
        });
    }
    normalizeContent(content, maxWords = 1500) {
        if (!content)
            return '';
        // Разбиваем на слова
        const words = content.split(/\s+/);
        // Обрезаем до maxWords
        if (words.length > maxWords) {
            return words.slice(0, maxWords).join(' ') + '...';
        }
        return content;
    }
    isVideoUrl(url) {
        const videoPatterns = [
            /youtube\.com\/watch/i,
            /youtu\.be\//i,
            /youtube\.com\/embed/i,
            /vimeo\.com\/\d+/i,
        ];
        return videoPatterns.some((pattern) => pattern.test(url));
    }
    extractVideoId(url) {
        // YouTube
        const youtubePatterns = [
            /youtube\.com\/watch\?v=([^&]+)/i,
            /youtu\.be\/([^?]+)/i,
            /youtube\.com\/embed\/([^?]+)/i,
        ];
        for (const pattern of youtubePatterns) {
            const match = url.match(pattern);
            if (match)
                return match[1];
        }
        // Vimeo
        const vimeoPattern = /vimeo\.com\/(\d+)/i;
        const vimeoMatch = url.match(vimeoPattern);
        if (vimeoMatch)
            return vimeoMatch[1];
        return null;
    }
}
exports.ContentParserService = ContentParserService;
