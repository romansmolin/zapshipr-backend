export interface IInstagramConnectorService {
    connectInstagramAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }>
}
