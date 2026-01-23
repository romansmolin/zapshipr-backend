export interface IBlueskyConnectorService {
	connectBlueskyAccount(
		userId: string,
        identifier: string,
        appPassword: string,
        workspaceId: string): Promise<{success: boolean}>
}