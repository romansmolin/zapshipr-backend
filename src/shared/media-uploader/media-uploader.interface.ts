import { ILogger } from '../logger/logger.interface'

export interface IMediaUploader {
    upload(data: { key: string; body: Buffer; contentType: string }): Promise<string>
    delete(url: string): Promise<void>
}
