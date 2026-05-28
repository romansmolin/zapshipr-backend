import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'

export const buildS3UrlFromKey = (key: string): string => {
    const bucket = process.env.AWS_S3_BUCKET
    if (!bucket) {
        throw new BaseAppError(
            'AWS_S3_BUCKET is required for uploadedMedia references',
            ErrorCode.UNKNOWN_ERROR,
            500
        )
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`
}
