import type { ILogger } from '@/shared/logger/logger.interface'
import { ContentParserService } from '../content-parser.service'

jest.mock('pdf-parse', () => ({
    PDFParse: jest.fn().mockImplementation(() => ({
        getText: jest.fn().mockResolvedValue({ text: 'Mock PDF body text for tests.' }),
        getInfo: jest.fn().mockResolvedValue({ info: { Title: 'Mock PDF Title' } }),
        destroy: jest.fn().mockResolvedValue(undefined),
    })),
}))

describe('ContentParserService', () => {
    jest.setTimeout(20000)

    const logger: ILogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('parses txt documents', async () => {
        const service = new ContentParserService(logger)
        const buffer = Buffer.from('Hello world\n\nThis is a test.', 'utf-8')

        const result = await service.parseDocument(buffer, 'sample.txt')

        expect(result.title).toBe('sample.txt')
        expect(result.content).toBe('Hello world This is a test.')
    })

    it('parses pdf documents', async () => {
        const service = new ContentParserService(logger)
        const pdfBuffer = Buffer.from('%PDF mock', 'utf-8')

        const result = await service.parseDocument(pdfBuffer, 'test.pdf')

        expect(result.title).toBeDefined()
        expect(result.title).toBe('Mock PDF Title')
        expect(result.content.length).toBeGreaterThan(0)
    })
})
