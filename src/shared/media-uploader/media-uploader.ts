import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { IMediaUploader } from './media-uploader.interface'
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
}
