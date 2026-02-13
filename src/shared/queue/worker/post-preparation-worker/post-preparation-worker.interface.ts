export interface IPostPreparationWorker {
    start(): void
    stop(): Promise<void>
}
