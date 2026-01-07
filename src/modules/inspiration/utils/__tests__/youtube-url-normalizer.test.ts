import {
    normalizeYouTubeUrl,
    parseTimestamp,
    isYouTubeUrl,
    extractYouTubeVideoId,
} from '../youtube-url-normalizer'

describe('parseTimestamp', () => {
    it('should parse plain number', () => {
        expect(parseTimestamp('90')).toBe(90)
        expect(parseTimestamp('0')).toBe(0)
        expect(parseTimestamp('3600')).toBe(3600)
    })

    it('should parse number with s suffix', () => {
        expect(parseTimestamp('90s')).toBe(90)
        expect(parseTimestamp('120S')).toBe(120)
    })

    it('should parse HMS format', () => {
        expect(parseTimestamp('1h2m3s')).toBe(3723)
        expect(parseTimestamp('1H2M3S')).toBe(3723)
        expect(parseTimestamp('2m30s')).toBe(150)
        expect(parseTimestamp('1h')).toBe(3600)
        expect(parseTimestamp('30m')).toBe(1800)
        expect(parseTimestamp('45s')).toBe(45)
        expect(parseTimestamp('1h30m')).toBe(5400)
    })

    it('should return null for invalid input', () => {
        expect(parseTimestamp(null)).toBeNull()
        expect(parseTimestamp('')).toBeNull()
        expect(parseTimestamp('   ')).toBeNull()
        expect(parseTimestamp('abc')).toBeNull()
        expect(parseTimestamp('1x2y3z')).toBeNull()
    })
})

describe('isYouTubeUrl', () => {
    it('should return true for valid YouTube URLs', () => {
        expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
        expect(isYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
        expect(isYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
        expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
        expect(isYouTubeUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('should return false for non-YouTube URLs', () => {
        expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false)
        expect(isYouTubeUrl('https://twitter.com/video')).toBe(false)
        expect(isYouTubeUrl('https://example.com')).toBe(false)
        expect(isYouTubeUrl('not-a-url')).toBe(false)
    })
})

describe('normalizeYouTubeUrl', () => {
    const VIDEO_ID = 'dQw4w9WgXcQ'

    describe('standard watch URLs', () => {
        it('should normalize standard watch URL', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                expect(result.ref.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`)
                expect(result.ref.isShorts).toBe(false)
                expect(result.ref.startSec).toBeNull()
                expect(result.ref.playlistId).toBeNull()
            }
        })

        it('should normalize URL without www', () => {
            const result = normalizeYouTubeUrl(`https://youtube.com/watch?v=${VIDEO_ID}`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
            }
        })

        it('should normalize mobile URL', () => {
            const result = normalizeYouTubeUrl(`https://m.youtube.com/watch?v=${VIDEO_ID}`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
            }
        })
    })

    describe('youtu.be short URLs', () => {
        it('should normalize youtu.be URL', () => {
            const result = normalizeYouTubeUrl(`https://youtu.be/${VIDEO_ID}`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                expect(result.ref.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`)
            }
        })

        it('should normalize youtu.be URL with timestamp', () => {
            const result = normalizeYouTubeUrl(`https://youtu.be/${VIDEO_ID}?t=90`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                expect(result.ref.startSec).toBe(90)
            }
        })
    })

    describe('shorts URLs', () => {
        it('should normalize shorts URL', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/shorts/${VIDEO_ID}`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                expect(result.ref.isShorts).toBe(true)
                expect(result.ref.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`)
            }
        })

        it('should normalize shorts URL with query params', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/shorts/${VIDEO_ID}?feature=share`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                expect(result.ref.isShorts).toBe(true)
            }
        })
    })

    describe('embed URLs', () => {
        it('should normalize embed URL', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/embed/${VIDEO_ID}`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                expect(result.ref.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`)
            }
        })
    })

    describe('live URLs', () => {
        it('should normalize live URL', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/live/${VIDEO_ID}`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
            }
        })
    })

    describe('timestamp parsing', () => {
        it('should parse t parameter with seconds', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=90`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.startSec).toBe(90)
            }
        })

        it('should parse t parameter with s suffix', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=90s`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.startSec).toBe(90)
            }
        })

        it('should parse t parameter with HMS format', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=1h2m3s`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.startSec).toBe(3723)
            }
        })

        it('should parse start parameter as fallback', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}&start=120`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.startSec).toBe(120)
            }
        })

        it('should prefer t over start parameter', () => {
            const result = normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=60&start=120`)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.startSec).toBe(60)
            }
        })
    })

    describe('playlist handling', () => {
        it('should extract playlist ID', () => {
            const result = normalizeYouTubeUrl(
                `https://www.youtube.com/watch?v=${VIDEO_ID}&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`
            )
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                expect(result.ref.playlistId).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
            }
        })
    })

    describe('marketing parameters', () => {
        it('should ignore marketing parameters and still extract video ID', () => {
            const result = normalizeYouTubeUrl(
                `https://www.youtube.com/watch?v=${VIDEO_ID}&pp=ygUJdGVzdCB0ZXN0&si=abc123&feature=share&utm_source=twitter`
            )
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.videoId).toBe(VIDEO_ID)
                // Marketing params should not affect the canonical URL
                expect(result.ref.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`)
            }
        })
    })

    describe('error cases', () => {
        it('should return error for empty URL', () => {
            const result = normalizeYouTubeUrl('')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('URL is required')
            }
        })

        it('should return error for invalid URL', () => {
            const result = normalizeYouTubeUrl('not-a-url')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Invalid URL format')
            }
        })

        it('should return error for non-YouTube URL', () => {
            const result = normalizeYouTubeUrl('https://vimeo.com/123456')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Not a YouTube URL')
            }
        })

        it('should return error for YouTube URL without video ID', () => {
            const result = normalizeYouTubeUrl('https://www.youtube.com/')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Could not extract video ID from URL')
            }
        })

        it('should return error for YouTube channel URL', () => {
            const result = normalizeYouTubeUrl('https://www.youtube.com/@channelname')
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('Could not extract video ID from URL')
            }
        })
    })

    describe('preserves raw URL', () => {
        it('should preserve the original raw URL', () => {
            const rawUrl = `https://www.youtube.com/watch?v=${VIDEO_ID}&t=90&pp=test`
            const result = normalizeYouTubeUrl(rawUrl)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.ref.rawUrl).toBe(rawUrl)
            }
        })
    })
})

describe('extractYouTubeVideoId', () => {
    it('should extract video ID from valid URL', () => {
        expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
        expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should return null for invalid URL', () => {
        expect(extractYouTubeVideoId('https://vimeo.com/123')).toBeNull()
        expect(extractYouTubeVideoId('not-a-url')).toBeNull()
    })
})

