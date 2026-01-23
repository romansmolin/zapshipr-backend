import { Account } from '@/modules/social/entity/account'
import { IAccountRepository } from '@/modules/social/repositories/account-repository.interface'
import { IAccountsService } from '@/modules/social/services/accounts.service.interface'
import { TikTokCreatorInfoDto } from '@/modules/social/types/account.types'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import { IApiClient } from '@/shared/http-client'
import { ILogger } from '@/shared/logger'
import { IMediaUploader } from '@/shared/media-uploader'
import { getEnvVar } from '@/shared/utils/get-env-var'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { uploadAccountAvatar } from '../../utils/upload-account-avatar'
import { upsertAccount } from '../../utils/upsert-account'
import { ITikTokConnectorService } from './tiktok-connector-service.interface'

type TikTokCreatorInfoResponse = {
    data?: {
        max_video_post_duration_sec?: number
        privacy_level_options?: string[]
        can_post?: boolean
        can_post_more?: boolean
        can_post_now?: boolean
        comment_disabled?: boolean
        duet_disabled?: boolean
        stitch_disabled?: boolean
        creator_nickname?: string
        creator_username?: string
    }
}

export class TikTokConnectorService implements ITikTokConnectorService {
    private readonly logger: ILogger
    private readonly httpClient: IApiClient
    private readonly mediaUploader: IMediaUploader
    private readonly accountRepository: IAccountRepository
    private readonly accountService: IAccountsService
    private readonly appId: string
    private readonly appSecret: string
    private readonly redirectUri: string
    private readonly backendUrl: string

    constructor(
        logger: ILogger,
        httpClient: IApiClient,
        mediaUploader: IMediaUploader,
        accountRepository: IAccountRepository,
        accountService: IAccountsService
    ) {
        this.logger = logger
        this.httpClient = httpClient
        this.mediaUploader = mediaUploader
        this.accountRepository = accountRepository
        this.accountService = accountService
        this.appId = getEnvVar('TIKTOK_APP_ID')
        this.appSecret = getEnvVar('TIKTOK_APP_SECRET')
        this.redirectUri = getEnvVar('TIKTOK_REDIRECT_URI')
        this.backendUrl = getEnvVar('BACKEND_URL')
    }

    async connectTikTokAccount(userId: string, code: string, workspaceId: string): Promise<{ success: boolean }> {
        try {
            const redirectUri = `${this.backendUrl}${this.redirectUri}`

            const formData = new URLSearchParams({
                client_key: this.appId,
                client_secret: this.appSecret,
                redirect_uri: redirectUri,
                code,
                grant_type: 'authorization_code',
            })

            const tokenResponse = await this.httpClient.post<{
                access_token: string
                refresh_token: string
                expires_in: number
                refresh_expires_in: number
            }>('https://open.tiktokapis.com/v2/oauth/token/', formData.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            })

            const accessToken = tokenResponse?.access_token

            if (!accessToken) {
                throw new BaseAppError('Failed to retrieve TikTok access token', ErrorCode.UNAUTHORIZED, 401)
            }

            const { refresh_token, expires_in, refresh_expires_in } = tokenResponse

            const refreshTokenExpiresIn = new Date(Date.now() + (refresh_expires_in || 0) * 1000)
            const tokenExpiresIn = new Date(Date.now() + (expires_in || 0) * 1000)

            const userInfoResponse = await this.httpClient.get<{
                data?: {
                    user?: {
                        open_id: string
                        union_id?: string
                        avatar_url?: string
                        display_name: string
                    }
                }
            }>('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
                headers: { Authorization: `Bearer ${accessToken}` },
            })

            const user = userInfoResponse.data?.user

            if (!user) {
                throw new BaseAppError('TikTok user info not found', ErrorCode.NOT_FOUND, 404)
            }

            const userAvatar = await uploadAccountAvatar(
                this.mediaUploader,
                userId,
                user.display_name || user.open_id,
                user.avatar_url
            )

            const creatorInfo = await this.getCreatorPostingInfo(accessToken, userId)

            this.logger.debug('Here is the Creator Info - ', { creatorInfo })

            const account = new Account(
                uuidv4(),
                userId,
                workspaceId,
                'tiktok',
                user.display_name,
                accessToken,
                new Date(),
                user.open_id,
                userAvatar,
                refresh_token,
                tokenExpiresIn,
                refreshTokenExpiresIn,
                creatorInfo.maxVideoPostDurationSec,
                creatorInfo.privacyLevelOptions
            )

            const { isNew } = await upsertAccount(account, this.accountRepository, this.accountService)

            this.logger.info('Successfully processed TikTok account', {
                operation: 'connect_tiktok_account',
                entity: 'Account',
                userId,
                wasCreated: isNew,
            })

            return { success: true }
        } catch (error: unknown) {
            this.logger.error('Failed to connect TikTok account', {
                operation: 'connect_tiktok_account',
                entity: 'Account',
                userId,
                error:
                    error instanceof Error
                        ? {
                              name: error.name,
                              stack: error.stack,
                          }
                        : { name: 'UnknownError' },

                axiosMessage: axios.isAxiosError(error)
                    ? error.response?.data?.error_description || error.message
                    : undefined,
            })

            if (axios.isAxiosError(error)) {
                const status = error.response?.status || 500

                if (status === 400 || status === 401) {
                    throw new BaseAppError(
                        'Invalid TikTok authorization code. Please try connecting again.',
                        ErrorCode.UNAUTHORIZED,
                        401
                    )
                }
            }

            if (error instanceof BaseAppError) {
                throw error
            }

            throw new BaseAppError('Failed to connect TikTok account', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    private async getCreatorPostingInfo(
        accessToken: string,
        userId: string
    ): Promise<{ maxVideoPostDurationSec: number | null; privacyLevelOptions: string[] | null }> {
        const apiBaseUrl = getEnvVar('TIKTOK_API_URL')
        const apiVersion = getEnvVar('TIKTOK_API_VERSION')

        try {
            const response = await this.httpClient.post<TikTokCreatorInfoResponse>(
                `${apiBaseUrl}/${apiVersion}/post/publish/creator_info/query/`,
                {}, // TikTok expects an empty JSON body; avoid sending headers as body
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            const infoPayload =
                (response as any)?.data ?? (response as any)?.creator_info ?? response ?? (response as any)?.data

            const rawDuration = infoPayload?.max_video_post_duration_sec

            const maxVideoPostDurationSec =
                typeof rawDuration === 'number'
                    ? rawDuration
                    : typeof rawDuration === 'string' && rawDuration
                      ? Number(rawDuration)
                      : null

            const privacyLevelOptions = Array.isArray(infoPayload?.privacy_level_options)
                ? infoPayload.privacy_level_options
                : null

            this.logger.debug('Fetched TikTok creator posting info', {
                operation: 'get_creator_posting_info',
                userId,
                hasMaxDuration: typeof maxVideoPostDurationSec === 'number',
                privacyOptionsCount: privacyLevelOptions?.length,
                rawKeys: infoPayload ? Object.keys(infoPayload) : [],
            })

            return {
                maxVideoPostDurationSec,
                privacyLevelOptions,
            }
        } catch (error) {
            throw new BaseAppError(
                'Unable to retrieve TikTok creator settings. Please try connecting again.',
                ErrorCode.UNKNOWN_ERROR,
                500
            )
        }
    }

    async getTikTokCreatorInfo(userId: string, workspaceId: string, socialAccountId: string): Promise<TikTokCreatorInfoDto> {
        const apiBaseUrl = getEnvVar('TIKTOK_API_URL')
        const apiVersion = getEnvVar('TIKTOK_API_VERSION')

        try {
            const account = await this.accountRepository.getAccountByUserIdAndSocialAccountId(
                userId,
                socialAccountId
            )

            if (!account || account.platform !== 'tiktok') {
                throw new BaseAppError('TikTok account not found', ErrorCode.NOT_FOUND, 404)
            }

            const response = await this.httpClient.post<TikTokCreatorInfoResponse>(
                `${apiBaseUrl}/${apiVersion}/post/publish/creator_info/query/`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${account.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            const payload = (response as any)?.data ?? (response as any)?.creator_info ?? response

            const canPostSignal = [payload?.can_post_now, payload?.can_post, payload?.can_post_more].find(
                (flag: unknown) => typeof flag === 'boolean'
            )

            const maxDuration = payload?.max_video_post_duration_sec
            const maxVideoPostDurationSec =
                typeof maxDuration === 'number' && Number.isFinite(maxDuration)
                    ? maxDuration
                    : typeof maxDuration === 'string'
                      ? Number(maxDuration)
                      : 0

            const privacyLevelOptions = Array.isArray(payload?.privacy_level_options)
                ? payload.privacy_level_options
                : []

            const allowComment = typeof payload?.comment_disabled === 'boolean' ? !payload.comment_disabled : true
            const allowDuet = typeof payload?.duet_disabled === 'boolean' ? !payload.duet_disabled : true
            const allowStitch = typeof payload?.stitch_disabled === 'boolean' ? !payload.stitch_disabled : true

            this.logger.info('Fetched TikTok creator info', {
                operation: 'getTikTokCreatorInfo',
                userId,
                socialAccountId,
                canPostNow: typeof canPostSignal === 'boolean' ? canPostSignal : true,
                maxVideoPostDurationSec: Number.isFinite(maxVideoPostDurationSec) ? maxVideoPostDurationSec : 0,
                privacyOptionsCount: privacyLevelOptions.length,
            })

            return {
                creatorId: account.pageId || socialAccountId,
                nickname: payload?.creator_nickname || payload?.creator_username || account.username,
                canPostNow: typeof canPostSignal === 'boolean' ? canPostSignal : true,
                privacyLevelOptions,
                maxVideoPostDurationSec: Number.isFinite(maxVideoPostDurationSec) ? maxVideoPostDurationSec : 0,
                interactions: {
                    allowComment,
                    allowDuet,
                    allowStitch,
                },
            }
        } catch (error) {
            if (error instanceof BaseAppError) {
                throw error
            }

            this.logger.error('Failed to fetch TikTok creator info', {
                operation: 'getTikTokCreatorInfo',
                userId,
                socialAccountId,
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    message: error instanceof Error ? error.message : undefined,
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })

            throw new BaseAppError(
                'TikTok is unavailable. Unable to retrieve creator info. Please try again later.',
                ErrorCode.UNKNOWN_ERROR,
                503
            )
        }
    }
}
