export interface IInspirationScheduler {
    scheduleInspiration(inspirationId: string, workspaceId: string, userId: string): Promise<void>
}
