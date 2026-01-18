import { TranscriptNormalizerService } from '../transcript-normalizer.service'

describe('TranscriptNormalizerService', () => {
    let service: TranscriptNormalizerService

    beforeEach(() => {
        service = new TranscriptNormalizerService()
    })

    describe('parseVTT', () => {
        it('should parse basic VTT format', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.500
Hello world

00:00:02.500 --> 00:00:05.000
This is a test`

            const result = service.parseVTT(vtt)

            expect(result.originalFormat).toBe('vtt')
            expect(result.segments).toHaveLength(2)
            expect(result.segments[0].text).toBe('Hello world')
            expect(result.segments[0].startSec).toBe(0)
            expect(result.segments[0].endSec).toBe(2.5)
            expect(result.segments[1].text).toBe('This is a test')
            expect(result.segments[1].startSec).toBe(2.5)
            expect(result.segments[1].endSec).toBe(5)
        })

        it('should handle VTT with cue identifiers', () => {
            const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
First line

2
00:00:02.000 --> 00:00:04.000
Second line`

            const result = service.parseVTT(vtt)

            expect(result.segments).toHaveLength(2)
            expect(result.segments[0].text).toBe('First line')
            expect(result.segments[1].text).toBe('Second line')
        })

        it('should remove VTT tags', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
<c>Hello</c> <v Speaker>world</v>`

            const result = service.parseVTT(vtt)

            expect(result.segments[0].text).toBe('Hello world')
        })

        it('should handle multi-line cues', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Line one
Line two
Line three`

            const result = service.parseVTT(vtt)

            expect(result.segments).toHaveLength(1)
            expect(result.segments[0].text).toBe('Line one Line two Line three')
        })

        it('should handle VTT without WEBVTT header', () => {
            const vtt = `00:00:00.000 --> 00:00:02.000
Hello world`

            const result = service.parseVTT(vtt)

            expect(result.segments).toHaveLength(1)
            expect(result.segments[0].text).toBe('Hello world')
        })
    })

    describe('parseSRT', () => {
        it('should parse basic SRT format', () => {
            const srt = `1
00:00:00,000 --> 00:00:02,500
Hello world

2
00:00:02,500 --> 00:00:05,000
This is a test`

            const result = service.parseSRT(srt)

            expect(result.originalFormat).toBe('srt')
            expect(result.segments).toHaveLength(2)
            expect(result.segments[0].text).toBe('Hello world')
            expect(result.segments[0].startSec).toBe(0)
            expect(result.segments[0].endSec).toBe(2.5)
            expect(result.segments[1].text).toBe('This is a test')
        })

        it('should handle SRT with HTML tags', () => {
            const srt = `1
00:00:00,000 --> 00:00:02,000
<i>Italic text</i> and <b>bold</b>`

            const result = service.parseSRT(srt)

            expect(result.segments[0].text).toBe('Italic text and bold')
        })

        it('should handle multi-line SRT', () => {
            const srt = `1
00:00:00,000 --> 00:00:03,000
Line one
Line two`

            const result = service.parseSRT(srt)

            expect(result.segments).toHaveLength(1)
            expect(result.segments[0].text).toBe('Line one Line two')
        })
    })

    describe('parseText', () => {
        it('should normalize plain text', () => {
            const text = `This is   some text
with multiple    spaces
and newlines.`

            const result = service.parseText(text)

            expect(result.originalFormat).toBe('text')
            expect(result.normalizedText).toBe(
                'This is some text with multiple spaces and newlines.'
            )
            expect(result.segments).toHaveLength(1)
        })
    })

    describe('parse (auto-detect)', () => {
        it('should detect VTT format', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
Hello`

            const result = service.parse(vtt)
            expect(result.originalFormat).toBe('vtt')
        })

        it('should detect SRT format', () => {
            const srt = `1
00:00:00,000 --> 00:00:02,000
Hello`

            const result = service.parse(srt)
            expect(result.originalFormat).toBe('srt')
        })

        it('should fall back to text format', () => {
            const text = 'Just some plain text without any timestamps.'

            const result = service.parse(text)
            expect(result.originalFormat).toBe('text')
        })
    })

    describe('duplicate removal', () => {
        it('should remove consecutive duplicate segments', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
Hello world

00:00:01.000 --> 00:00:02.000
Hello world

00:00:02.000 --> 00:00:03.000
Different text`

            const result = service.parseVTT(vtt, { removeDuplicates: true })

            expect(result.segments).toHaveLength(2)
            expect(result.segments[0].text).toBe('Hello world')
            expect(result.segments[1].text).toBe('Different text')
            expect(result.stats.duplicatesRemoved).toBe(1)
        })

        it('should merge timing on duplicate removal', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
Hello

00:00:01.000 --> 00:00:03.000
Hello`

            const result = service.parseVTT(vtt, { removeDuplicates: true })

            expect(result.segments).toHaveLength(1)
            expect(result.segments[0].startSec).toBe(0)
            expect(result.segments[0].endSec).toBe(3)
        })

        it('should keep duplicates when disabled', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
Hello

00:00:01.000 --> 00:00:02.000
Hello`

            const result = service.parseVTT(vtt, { removeDuplicates: false })

            expect(result.segments).toHaveLength(2)
        })
    })

    describe('stats calculation', () => {
        it('should calculate correct statistics', () => {
            const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
One two three

00:00:05.000 --> 00:00:10.000
Four five six seven`

            const result = service.parseVTT(vtt)

            expect(result.stats.segmentCount).toBe(2)
            expect(result.stats.totalDurationSec).toBe(10)
            expect(result.stats.wordCount).toBe(7)
            expect(result.stats.characterCount).toBeGreaterThan(0)
        })
    })

    describe('edge cases', () => {
        it('should handle empty input', () => {
            const result = service.parse('')
            expect(result.segments).toHaveLength(0)
            expect(result.normalizedText).toBe('')
        })

        it('should handle VTT with only header', () => {
            const result = service.parseVTT('WEBVTT\n\n')
            expect(result.segments).toHaveLength(0)
        })

        it('should handle malformed timing', () => {
            const vtt = `WEBVTT

not a timing line
Some text

00:00:00.000 --> 00:00:01.000
Valid text`

            const result = service.parseVTT(vtt)

            expect(result.segments).toHaveLength(1)
            expect(result.segments[0].text).toBe('Valid text')
        })
    })
})

