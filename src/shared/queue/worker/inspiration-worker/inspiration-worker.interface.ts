export interface InspirationJobData {
    inspirationId: string
    workspaceId: string
    userId: string
}

export interface IInspirationWorker {
    /**
     * Запустить воркер
     */
    start(): void

    /**
     * Остановить воркер
     */
    stop(): Promise<void>
}

