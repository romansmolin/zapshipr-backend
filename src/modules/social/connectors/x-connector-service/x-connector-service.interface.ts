export interface IXConnectorService {
    connectXAccount(userId: string, code: string, codeVerifier: string, workspaceId: string): Promise<{ success: boolean }>
}
