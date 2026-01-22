const DATE_TIME_RE =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/

type DateParts = {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
    millisecond: number
}

const parseDateParts = (value: string): DateParts | null => {
    const match = DATE_TIME_RE.exec(value.trim())
    if (!match) return null

    const [, year, month, day, hour, minute, second, millisecond] = match

    return {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: hour ? Number(hour) : 0,
        minute: minute ? Number(minute) : 0,
        second: second ? Number(second) : 0,
        millisecond: millisecond ? Number(millisecond.padEnd(3, '0')) : 0,
    }
}

const getTimeZoneOffsetMs = (timeZone: string, date: Date): number => {
    const values = formatDateParts(timeZone, date)

    const asUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second)

    return asUtc - date.getTime()
}

const formatDateParts = (timeZone: string, date: Date): DateParts => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })

    const parts = formatter.formatToParts(date)
    const values: Record<string, string> = {}
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value
        }
    }

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour),
        minute: Number(values.minute),
        second: Number(values.second),
        millisecond: date.getUTCMilliseconds(),
    }
}

const partsMatch = (expected: DateParts, actual: DateParts): boolean => {
    return (
        expected.year === actual.year &&
        expected.month === actual.month &&
        expected.day === actual.day &&
        expected.hour === actual.hour &&
        expected.minute === actual.minute &&
        expected.second === actual.second &&
        expected.millisecond === actual.millisecond
    )
}

export const isValidTimeZone = (timeZone: string): boolean => {
    try {
        Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
        return true
    } catch {
        return false
    }
}

export const hasTimeZoneInfo = (value: string): boolean => {
    return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())
}

export const parseDateWithTimeZone = (value: string, timeZone: string): Date | null => {
    const parts = parseDateParts(value)
    if (!parts) return null

    const utcGuess = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond
    )

    const guessDate = new Date(utcGuess)
    const initialOffset = getTimeZoneOffsetMs(timeZone, guessDate)
    let candidate = new Date(utcGuess - initialOffset)

    const adjustedOffset = getTimeZoneOffsetMs(timeZone, candidate)
    if (adjustedOffset !== initialOffset) {
        candidate = new Date(utcGuess - adjustedOffset)
    }

    const candidateParts = formatDateParts(timeZone, candidate)
    if (!partsMatch(parts, candidateParts)) {
        return null
    }

    return candidate
}
