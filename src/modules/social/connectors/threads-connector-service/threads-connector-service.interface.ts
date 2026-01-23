export interface IThreadsConnectorService {
    connectThreadsAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }>
}
