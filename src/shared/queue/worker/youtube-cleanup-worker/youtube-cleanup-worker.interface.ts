export interface IYoutubeCleanupWorker {
    start(): void
    stop(): Promise<void>
}
