import {
    QualityGate,
    DEFAULT_QUALITY_RULES,
    RETRY_QUALITY_RULES,
    buildRetryPromptEnhancement,
} from '../quality-gate'
import { YouTubeExtractionData } from '../schemas/youtube-extraction.schema'

describe('QualityGate', () => {
    let qualityGate: QualityGate

    beforeEach(() => {
        qualityGate = new QualityGate()
    })

    const createValidExtraction = (): YouTubeExtractionData => ({
        titleGuess: 'Test Video Title',
        language: 'en',
        summary: 'This is a test summary about the video content.',
        keyPoints: [
            'Key point 1 with 50% improvement',
            'Key point 2 about John Doe method',
            'Key point 3 with specific framework',
            'Key point 4 mentioning 1000 users',
            'Key point 5 about the strategy',
            'Key point 6 with concrete example',
            'Key point 7 about implementation',
        ],
        hooks: [
            'Hook 1: Did you know 95% of people fail at this?',
            'Hook 2: The secret framework nobody talks about',
            'Hook 3: I tested this for 30 days and here\'s what happened',
            'Hook 4: Why most entrepreneurs get this wrong',
            'Hook 5: The 3-step method that changed everything',
            'Hook 6: What if I told you this was possible?',
            'Hook 7: Stop doing this mistake immediately',
            'Hook 8: The truth about modern marketing',
            'Hook 9: How to 10x your results',
            'Hook 10: This one thing separates winners from losers',
            'Hook 11: Unpopular opinion: traditional methods are dead',
            'Hook 12: The real reason you\'re not succeeding',
        ],
        quotes: [
            { text: 'Quote 1 from the speaker', startSec: 30, endSec: 45 },
            { text: 'Quote 2 with important insight', startSec: 120, endSec: 135 },
            { text: 'Quote 3 memorable statement', startSec: 200, endSec: 220 },
            { text: 'Quote 4 key message', startSec: 300, endSec: 315 },
        ],
        contentAngles: [
            { angle: 'Educational breakdown', whyItWorks: 'People love learning' },
            { angle: 'Contrarian take', whyItWorks: 'Sparks debate' },
            { angle: 'Personal story', whyItWorks: 'Builds connection' },
            { angle: 'How-to guide', whyItWorks: 'Actionable content' },
            { angle: 'Case study', whyItWorks: 'Social proof' },
            { angle: 'Behind the scenes', whyItWorks: 'Exclusive feel' },
        ],
        drafts: {
            threads: ['Thread 1 content', 'Thread 2 content', 'Thread 3 content'],
            x: ['Tweet 1', 'Tweet 2', 'Tweet 3'],
            linkedin: ['LinkedIn post 1', 'LinkedIn post 2', 'LinkedIn post 3'],
            instagramCaption: ['Instagram caption 1', 'Instagram caption 2', 'Instagram caption 3'],
        },
        tags: ['marketing', 'business', 'growth', 'strategy', 'tips', 'success'],
        tone: 'educational',
    })

    describe('validate', () => {
        it('should pass for valid extraction', () => {
            const extraction = createValidExtraction()
            const result = qualityGate.validate(extraction)

            expect(result.passed).toBe(true)
            expect(result.score).toBeGreaterThanOrEqual(60)
            expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0)
        })

        it('should fail when hooks are below minimum', () => {
            const extraction = createValidExtraction()
            extraction.hooks = ['Hook 1', 'Hook 2', 'Hook 3'] // Less than 10

            const result = qualityGate.validate(extraction)

            expect(result.passed).toBe(false)
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    field: 'hooks',
                    code: 'BELOW_MINIMUM',
                    severity: 'error',
                })
            )
        })

        it('should fail when key points are below minimum', () => {
            const extraction = createValidExtraction()
            extraction.keyPoints = ['Point 1', 'Point 2'] // Less than 5

            const result = qualityGate.validate(extraction)

            expect(result.passed).toBe(false)
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    field: 'keyPoints',
                    code: 'BELOW_MINIMUM',
                    severity: 'error',
                })
            )
        })

        it('should fail when quotes are below minimum', () => {
            const extraction = createValidExtraction()
            extraction.quotes = [{ text: 'Single quote', startSec: 10, endSec: 20 }]

            const result = qualityGate.validate(extraction)

            expect(result.passed).toBe(false)
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    field: 'quotes',
                    code: 'BELOW_MINIMUM',
                    severity: 'error',
                })
            )
        })

        it('should fail when drafts are empty', () => {
            const extraction = createValidExtraction()
            extraction.drafts = {
                threads: [],
                x: [],
                linkedin: [],
                instagramCaption: [],
            }

            const result = qualityGate.validate(extraction)

            expect(result.passed).toBe(false)
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    field: 'drafts.threads',
                    code: 'EMPTY_FIELD',
                    severity: 'error',
                })
            )
        })

        it('should warn about duplicate content', () => {
            const extraction = createValidExtraction()
            extraction.hooks = [
                'The same hook repeated',
                'The same hook repeated',
                'The same hook repeated',
                'The same hook repeated',
                'The same hook repeated',
                'Different hook 1',
                'Different hook 2',
                'Different hook 3',
                'Different hook 4',
                'Different hook 5',
            ]

            const result = qualityGate.validate(extraction)

            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    field: 'hooks',
                    code: 'DUPLICATE_CONTENT',
                    severity: 'warning',
                })
            )
        })

        it('should warn about generic content', () => {
            const extraction = createValidExtraction()
            extraction.hooks = [
                'This has valuable insights for everyone',
                'Check it out, highly recommended content',
                'Great content with important information',
                'Must watch video with useful tips',
                'Really interesting and very helpful',
                'Hook 6',
                'Hook 7',
                'Hook 8',
                'Hook 9',
                'Hook 10',
            ]

            const result = qualityGate.validate(extraction)

            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    field: 'hooks',
                    code: 'TOO_GENERIC',
                    severity: 'warning',
                })
            )
        })

        it('should warn about missing specifics', () => {
            const extraction = createValidExtraction()
            extraction.keyPoints = [
                'A general statement about something',
                'Another vague point without details',
                'Something else without numbers',
                'Yet another non-specific item',
                'The final generic point here',
            ]

            const result = qualityGate.validate(extraction)

            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    field: 'keyPoints',
                    code: 'MISSING_SPECIFICS',
                    severity: 'warning',
                })
            )
        })
    })

    describe('calculateScore', () => {
        it('should return 100 for perfect extraction', () => {
            const extraction = createValidExtraction()
            // Add more items to ensure all minimums are exceeded
            extraction.hooks = Array(15).fill(null).map((_, i) => `Unique hook ${i + 1}`)
            extraction.keyPoints = Array(7).fill(null).map((_, i) => `Key point ${i + 1} with 50% stat`)
            extraction.quotes = Array(5).fill(null).map((_, i) => ({ text: `Quote ${i}`, startSec: i * 10, endSec: i * 10 + 5 }))
            extraction.contentAngles = Array(7).fill(null).map((_, i) => ({ angle: `Angle ${i}`, whyItWorks: `Because ${i}` }))
            extraction.tags = Array(8).fill(null).map((_, i) => `tag${i}`)

            const score = qualityGate.calculateScore(extraction)

            expect(score).toBeGreaterThanOrEqual(90)
        })

        it('should return lower score for minimal extraction', () => {
            const extraction = createValidExtraction()
            extraction.hooks = ['Hook 1', 'Hook 2', 'Hook 3']
            extraction.keyPoints = ['Point 1', 'Point 2']
            extraction.quotes = [{ text: 'Quote', startSec: 0, endSec: 5 }]
            extraction.contentAngles = [{ angle: 'Angle', whyItWorks: 'Why' }]
            extraction.tags = ['tag1', 'tag2']

            const score = qualityGate.calculateScore(extraction)

            expect(score).toBeLessThan(60)
        })
    })

    describe('getSuggestions', () => {
        it('should generate suggestions based on issues', () => {
            const issues = [
                { field: 'hooks', code: 'BELOW_MINIMUM' as const, message: 'Test', severity: 'error' as const },
                { field: 'keyPoints', code: 'BELOW_MINIMUM' as const, message: 'Test', severity: 'error' as const },
                { field: 'hooks', code: 'DUPLICATE_CONTENT' as const, message: 'Test', severity: 'warning' as const },
                { field: 'keyPoints', code: 'TOO_GENERIC' as const, message: 'Test', severity: 'warning' as const },
            ]

            const suggestions = qualityGate.getSuggestions(issues)

            expect(suggestions).toContainEqual(expect.stringContaining('Generate more content'))
            expect(suggestions).toContainEqual(expect.stringContaining('unique'))
            expect(suggestions).toContainEqual(expect.stringContaining('specific'))
        })
    })

    describe('buildRetryPromptEnhancement', () => {
        it('should build retry prompt with issues', () => {
            const issues = [
                { field: 'hooks', code: 'BELOW_MINIMUM' as const, message: 'hooks has 5 items, minimum is 10', severity: 'error' as const },
            ]
            const suggestions = ['Generate more hooks']

            const enhancement = buildRetryPromptEnhancement(issues, suggestions)

            expect(enhancement).toContain('QUALITY REQUIREMENTS')
            expect(enhancement).toContain('Generate more hooks')
            expect(enhancement).toContain('STRICT MINIMUMS')
        })
    })

    describe('quality rules', () => {
        it('should have stricter RETRY rules than DEFAULT', () => {
            expect(RETRY_QUALITY_RULES.minHooks).toBeGreaterThan(DEFAULT_QUALITY_RULES.minHooks)
            expect(RETRY_QUALITY_RULES.minKeyPoints).toBeGreaterThan(DEFAULT_QUALITY_RULES.minKeyPoints)
            expect(RETRY_QUALITY_RULES.minQuotes).toBeGreaterThan(DEFAULT_QUALITY_RULES.minQuotes)
            expect(RETRY_QUALITY_RULES.maxDuplicateRatio).toBeLessThan(DEFAULT_QUALITY_RULES.maxDuplicateRatio)
        })
    })
})

