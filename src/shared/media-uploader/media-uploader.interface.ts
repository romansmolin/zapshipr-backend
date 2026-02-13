import { ILogger } from '../logger/logger.interface'

export interface ListObjectsResult {
    items: Array<{
        key: string
        size: number
        lastModified: Date
        contentType?: string
    }>
    nextContinuationToken?: string
    isTruncated: boolean
}

export interface PresignedUploadUrlResult {
    uploadUrl: string
    key: string
    expiresAt: string
    headers?: Record<string, string>
}

export interface IMediaUploader {
    upload(data: { key: string; body: Buffer; contentType: string }): Promise<string>
    delete(url: string): Promise<void>
    listObjects(params: {
        prefix: string
        maxKeys?: number
        continuationToken?: string
    }): Promise<ListObjectsResult>
    getSignedUrl(key: string, expiresIn: number): Promise<string>
    getPresignedUploadUrl(data: {
        key: string
        contentType: string
        expiresIn: number
    }): Promise<PresignedUploadUrlResult>
}
