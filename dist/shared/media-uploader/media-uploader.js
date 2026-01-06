"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Uploader = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
class S3Uploader {
    constructor(logger) {
        this.logger = logger;
        this.client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        this.bucket = process.env.AWS_S3_BUCKET || '';
    }
    async upload(data) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: data.key,
            Body: data.body,
            ContentType: data.contentType,
        });
        await this.client.send(command);
        this.logger.info('File uploaded to S3', {
            operation: 'upload',
            key: data.key,
            bucket: this.bucket,
            contentType: data.contentType,
            size: data.body.length,
        });
        return `https://${this.bucket}.s3.amazonaws.com/${data.key}`;
    }
    async delete(url) {
        const key = url.split('.s3.amazonaws.com/')[1];
        if (!key) {
            this.logger.warn('Invalid S3 URL provided for delete', {
                operation: 'delete',
                url,
            });
            return;
        }
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        await this.client.send(command);
        this.logger.info('File deleted from S3', {
            operation: 'delete',
            key,
            bucket: this.bucket,
        });
    }
}
exports.S3Uploader = S3Uploader;
