import {
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'
import { IMediaUploader, ListObjectsResult, PresignedUploadUrlResult } from './media-uploader.interface'
import { ILogger } from '../logger/logger.interface'

export class S3Uploader implements IMediaUploader {
    private client: S3Client
    private bucket: string

    constructor(private readonly logger: ILogger) {
        this.client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        })

        this.bucket = process.env.AWS_S3_BUCKET || ''
    }

    async upload(data: { key: string; body: Buffer; contentType: string }): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: data.key,
            Body: data.body,
            ContentType: data.contentType,
        })

        await this.client.send(command)

        this.logger.info('File uploaded to S3', {
            operation: 'upload',
            key: data.key,
            bucket: this.bucket,
            contentType: data.contentType,
            size: data.body.length,
        })

        return `https://${this.bucket}.s3.amazonaws.com/${data.key}`
    }

    async delete(url: string): Promise<void> {
        const key = url.split('.s3.amazonaws.com/')[1]

        if (!key) {
            this.logger.warn('Invalid S3 URL provided for delete', {
                operation: 'delete',
                url,
            })
            return
        }

        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        })

        await this.client.send(command)

        this.logger.info('File deleted from S3', {
            operation: 'delete',
            key,
            bucket: this.bucket,
        })
    }

    async listObjects(params: {
        prefix: string
        maxKeys?: number
        continuationToken?: string
    }): Promise<ListObjectsResult> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: params.prefix,
            MaxKeys: params.maxKeys || 50,
            ContinuationToken: params.continuationToken,
        })

        const response = await this.client.send(command)

        const items =
            response.Contents?.filter((obj) => obj.Key && !obj.Key.endsWith('/')).map((obj) => ({
                key: obj.Key!,
                size: obj.Size || 0,
                lastModified: obj.LastModified || new Date(),
                contentType: undefined,
            })) || []

        this.logger.info('Listed objects from S3', {
            operation: 'listObjects',
            prefix: params.prefix,
            bucket: this.bucket,
            count: items.length,
            isTruncated: response.IsTruncated || false,
        })

        return {
            items,
            nextContinuationToken: response.NextContinuationToken,
            isTruncated: response.IsTruncated || false,
        }
    }

    async getSignedUrl(key: string, expiresIn: number): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        })

        const signedUrl = await awsGetSignedUrl(this.client, command, { expiresIn })

        this.logger.info('Generated signed URL', {
            operation: 'getSignedUrl',
            key,
            bucket: this.bucket,
            expiresIn,
        })

        return signedUrl
    }

    async getPresignedUploadUrl(data: {
        key: string
        contentType: string
        expiresIn: number
    }): Promise<PresignedUploadUrlResult> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: data.key,
            ContentType: data.contentType,
        })

        const uploadUrl = await awsGetSignedUrl(this.client, command, { expiresIn: data.expiresIn })
        const expiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString()

        this.logger.info('Generated presigned upload URL', {
            operation: 'getPresignedUploadUrl',
            key: data.key,
            bucket: this.bucket,
            contentType: data.contentType,
            expiresIn: data.expiresIn,
        })

        return {
            uploadUrl,
            key: data.key,
            expiresAt,
            headers: {
                'Content-Type': data.contentType,
            },
        }
    }
}
