export interface IYouTubeConnectorService {
    connectYouTubeAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }>
}
