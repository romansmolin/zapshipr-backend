export interface InspirationJobData {
    inspirationId: string
    workspaceId: string
    userId: string
}

export interface IInspirationWorker {
    start(): void
    stop(): Promise<void>
}
