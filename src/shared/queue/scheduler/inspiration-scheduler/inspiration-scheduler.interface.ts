export interface IInspirationScheduler {
    /**
     * Добавить inspiration в очередь для обработки
     */
    scheduleInspiration(inspirationId: string, workspaceId: string, userId: string): Promise<void>
}

