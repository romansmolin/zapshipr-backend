export interface IVideoProcessor {
    processVideoWithCover(videoBuffer: Buffer, coverImageUrl: string, filters?: VideoFilter[]): Promise<Buffer>
    processVideoForPlatform(
        videoBuffer: Buffer,
        platform: 'instagram' | 'tiktok' | 'facebook' | 'threads'
    ): Promise<Buffer>
}

export interface VideoFilter {
    name: string
    options?: Record<string, any>
}

export interface TikTokVideoRequirements {
    aspectRatio: '9:16' | '1:1' | '16:9'
    maxDuration: number
    maxFileSize: number
    supportedFormats: string[]
}

export interface InstagramVideoRequirements {
    aspectRatio: '9:16' | '1:1' | '4:5' | '16:9'
    maxDuration: number
    maxFileSize: number
    supportedFormats: string[]
    videoType: 'reel' | 'post' | 'story'
}

export interface VideoProcessingOptions {
    platform: 'instagram' | 'tiktok' | 'facebook' | 'threads'
    videoType?: 'reel' | 'post' | 'story'
    addPadding?: boolean
    backgroundColor?: string
    quality?: 'high' | 'medium' | 'low'
}
