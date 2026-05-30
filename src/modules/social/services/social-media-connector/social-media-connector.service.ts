import { SocilaMediaPlatform } from "@/modules/post/schemas/posts.schemas"
import { IAccountRepository } from "@/modules/social/repositories/account-repository.interface"
import { IAccountsService } from "@/modules/social/services/accounts.service.interface"
import { IBlueskyConnectorService } from "@/modules/social/connectors/bluesky-connector-service/bluesky-connector-service.interface"
import { IFacebookConnectorService } from "@/modules/social/connectors/facebook-connector-service/facebook-connector-service.interface"
import { IInstagramConnectorService } from "@/modules/social/connectors/instagram-connector-service/instagram-connector-service.interface"
import { ILinkedinConnectorService } from "@/modules/social/connectors/linkedin-connector-service/linkedin-connector-service.interface"
import { IPinterestConnectorService } from "@/modules/social/connectors/pinterest-connector-service/pinterest-connector-service.interface"
import { IThreadsConnectorService } from "@/modules/social/connectors/threads-connector-service/threads-connector-service.interface"
import { ITikTokConnectorService } from "@/modules/social/connectors/tiktok-connector-service/tiktok-connector-service.interface"
import { IYouTubeConnectorService } from "@/modules/social/connectors/youtube-connector-service/youtube-connector-service.interface"
import { IXConnectorService } from "@/modules/social/connectors/x-connector-service/x-connector-service.interface"
import { SocialMediaConnectorFactory } from "@/modules/social/factories/social-media-connector.factory"
import { TikTokCreatorInfoDto } from "@/modules/social/types/account.types"
import { IApiClient } from "@/shared/http-client"
import { ILogger } from "@/shared/logger/logger.interface"
import { IMediaUploader } from "@/shared/media-uploader/media-uploader.interface"
import { ISocilaMediaConnectorService } from "./social-media-connector.interface"

export class SocilaMediaConnectorService implements ISocilaMediaConnectorService {
    private readonly connectorFactory: SocialMediaConnectorFactory

    constructor(
        logger: ILogger,
        mediaUploader: IMediaUploader,
        accountRepository: IAccountRepository,
        apiClient: IApiClient,
        accountsService: IAccountsService
    ) {
        this.connectorFactory = new SocialMediaConnectorFactory(
            logger,
            apiClient,
            mediaUploader,
            accountRepository,
            accountsService
        )
    }

    async connectFacebookAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.FACEBOOK) as IFacebookConnectorService
        return connector.connectFacebookAccount(userId, code, workspaceId)
    }

    async connectInstagramAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.INSTAGRAM) as IInstagramConnectorService
        return connector.connectInstagramAccount(userId, code, workspaceId)
    }

    async connectThreadsAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.THREADS) as IThreadsConnectorService
        return connector.connectThreadsAccount(userId, code, workspaceId)
    }

    async connectTikTokAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.TIKTOK) as ITikTokConnectorService
        return connector.connectTikTokAccount(userId, code, workspaceId)
    }

    async connectYouTubeAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.YOUTUBE) as IYouTubeConnectorService
        return connector.connectYouTubeAccount(userId, code, workspaceId)
    }

    async connectBlueskyAccount(userId: string, identifier: string, appPassword: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.BLUESKY) as IBlueskyConnectorService
        return connector.connectBlueskyAccount(userId, identifier, appPassword, workspaceId)
    }

    async connectXAccount(userId: string, code: string, codeVerifier: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.X) as IXConnectorService
        return connector.connectXAccount(userId, code, codeVerifier, workspaceId)
    }

    async connectPinterestAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.PINTEREST) as IPinterestConnectorService
        return connector.connectPinterestAccount(userId, code, workspaceId)
    }

    async connectLinkedinAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.LINKEDIN) as ILinkedinConnectorService
        return connector.connectLinkedinAccount(userId, code, workspaceId)
    }

    async getTikTokCreatorInfo(userId: string, workspaceId: string, socialAccountId: string): Promise<TikTokCreatorInfoDto> {
        const connector = this.connectorFactory.create(SocilaMediaPlatform.TIKTOK) as ITikTokConnectorService
        return connector.getTikTokCreatorInfo(userId, workspaceId, socialAccountId)
    }
}
