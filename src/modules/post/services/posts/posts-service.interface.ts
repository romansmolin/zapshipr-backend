import type { PostTargetEntity } from '@/modules/post/entity/post-target'
import type {
    CreatePostsRequest,
    PresignUploadFileRequest,
    PresignedUploadResponseItem,
    MediaTransformRequest,
} from '@/modules/post/schemas/posts.schemas'
import type { ErrorCode } from '@/shared/consts/error-codes.const'
import type {
    CreatePostResponse,
    PostFilters,
    PostStatus,
    PostsByDateResponse,
    PostsListResponse,
    PostTargetResponse,
} from '@/modules/post/types/posts.types'

export interface MediaCompatibilityDetails {
    incompatibleAccounts: Array<{
        accountId: string
        platform: string
        reason: string
    }>
}

export interface ServiceErrorEnvelope<K extends string, Details> {
    ok: false
    kind: K
    code: ErrorCode
    message: string
    status: number
    errorId: string
    details: Details
}

export type MediaCompatibilityError = ServiceErrorEnvelope<'MEDIA_COMPATIBILITY', MediaCompatibilityDetails>

export interface PostCreateQueuedResponse {
    postId: string
    status: PostStatus
    queued: true
}

export interface PostPreparationJobPayload {
    postId: string
    userId: string
    workspaceId: string
    mediaTransforms: MediaTransformRequest[]
    selectedMediaIndices: number[]
}

export interface IPostsService {
    createPost(
        createPostsRequest: CreatePostsRequest,
        medias: { [fieldname: string]: Express.Multer.File[] } | undefined | Express.Multer.File[],
        userId: string,
        workspaceId: string
    ): Promise<CreatePostResponse | MediaCompatibilityError | PostCreateQueuedResponse>

    createPresignedUploadUrls(
        userId: string,
        workspaceId: string,
        files: PresignUploadFileRequest[]
    ): Promise<PresignedUploadResponseItem[]>

    processPostPreparationJob(payload: PostPreparationJobPayload): Promise<void>

    editPost(
        postId: string,
        updatePostRequest: CreatePostsRequest,
        file: Express.Multer.File | undefined,
        userId: string,
        workspaceId: string
    ): Promise<void>

    hasExistingMedia(postId: string): Promise<boolean>

    getPostsByFilters(userId: string, workspaceId: string, filters: PostFilters): Promise<PostsListResponse>

    deletePost(postId: string, userId: string, workspaceId: string): Promise<void>
    deletePostsOrphanedByAccount(userId: string, accountId: string): Promise<void>

    getPostsByDate(userId: string, workspaceId: string, fromDate: Date, toDate: Date): Promise<PostsByDateResponse>

    getPostsFailedCount(userId: string, workspaceId: string): Promise<number>

    retryPostTarget(
        userId: string,
        workspaceId: string,
        postId: string,
        socialAccountId: string
    ): Promise<{ postTarget: PostTargetResponse; post: CreatePostResponse }>

    checkAndUpdateBasePostStatus(userId: string, postId: string): Promise<void>
    getFailedPostTargets(userId: string, workspaceId: string): Promise<PostTargetEntity[]>
    cancelPostTarget(userId: string, postId: string, socialAccountId: string): Promise<void>
    deletePostTarget(userId: string, workspaceId: string, postId: string, socialAccountId: string): Promise<void>
}
