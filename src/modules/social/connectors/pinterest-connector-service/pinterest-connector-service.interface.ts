export interface IPinterestConnectorService {
    connectPinterestAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }>
}
