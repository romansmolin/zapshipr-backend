import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

import { AppError, ErrorMessageCode } from '@/shared/errors/app-error'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TOKEN_PART_SEPARATOR = '.'

const getEncryptionKey = () => {
    const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY

    if (!secret) {
        throw new AppError({
            errorMessageCode: ErrorMessageCode.INTERNAL_SERVER_ERROR,
            httpCode: 500,
        })
    }

    return createHash('sha256').update(secret).digest()
}

export const encryptToken = (value: string): string => {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(TOKEN_PART_SEPARATOR)
}

export const decryptToken = (value: string): string => {
    const parts = value.split(TOKEN_PART_SEPARATOR)

    // If token doesn't have 3 parts (iv.tag.encrypted), assume it's plaintext (legacy data)
    if (parts.length !== 3) {
        return value
    }

    const [ivBase64, tagBase64, encryptedBase64] = parts

    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
        // If any part is missing, assume it's plaintext (legacy data)
        return value
    }

    try {
        const iv = Buffer.from(ivBase64, 'base64')
        const tag = Buffer.from(tagBase64, 'base64')
        const encrypted = Buffer.from(encryptedBase64, 'base64')
        const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv)

        decipher.setAuthTag(tag)

        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

        return decrypted.toString('utf8')
    } catch (error) {
        // If decryption fails, assume it's plaintext (legacy data)
        return value
    }
}

export const encryptNullableToken = (value?: string | null) => {
    return value ? encryptToken(value) : null
}

export const decryptNullableToken = (value?: string | null) => {
    if (!value) {
        return null
    }
    return decryptToken(value)
}
