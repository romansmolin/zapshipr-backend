export interface IFacebookConnectorService {
    connectFacebookAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }>
}
