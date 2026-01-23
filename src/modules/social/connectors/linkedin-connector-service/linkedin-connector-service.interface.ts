export interface ILinkedinConnectorService {
    connectLinkedinAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }>
}
