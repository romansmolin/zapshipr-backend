import type { PostTargetEntity } from '@/modules/post/entity/post-target'
import type { PostType } from '@/modules/post/schemas/posts.schemas'
import type {
    CreatePostResponse,
    PostFilters,
    PostMediaAsset,
    PostStatus,
    PostTarget,
    PostTargetResponse,
    PostsByDateResponse,
    PostsListResponse,
} from '@/modules/post/types/posts.types'

export interface IPostsRepository {
    createBasePost(
        userId: string,
        workspaceId: string,
        status: PostStatus,
        postType: PostType,
        scheduledAtLocal?: string | null,
        scheduledTimezone?: string | null,
        mainCaption?: string | null,
        coverTimestamp?: number | null,
        coverImageUrl?: string | null
    ): Promise<{ postId: string }>

    updateBasePost(
        postId: string,
        userId: string,
        status: PostStatus,
        mainCaption?: string | null,
        scheduledAtLocal?: string | null,
        scheduledTimezone?: string | null
    ): Promise<void>

    savePostMediaAssets(data: { userId: string; url: string; type: string }): Promise<{ mediaId: string }>

    createPostMediaAssetRelation(postId: string, mediaId: string, order: number): Promise<void>

    getPostMediaAsset(postId: string): Promise<PostMediaAsset | null>

    getPostMediaAssets(postId: string): Promise<PostMediaAsset[]>

    getPostCoverImageUrl(postId: string): Promise<string | null>

    deletePostMediaAsset(mediaId: string): Promise<void>

    createPostTargets(targets: PostTarget[]): Promise<void>

    updatePostTargets(postId: string, targets: PostTarget[]): Promise<void>

    updatePostTarget(
        userId: string,
        postId: string,
        socialAccountId: string,
        status: PostStatus,
        errorMessage?: string
    ): Promise<void>

    getPostDetails(postId: string, userId: string): Promise<CreatePostResponse>

    getPosts(userId: string, workspaceId: string, filters: PostFilters): Promise<PostsListResponse>

    hasExistingMedia(postId: string): Promise<boolean>

    deletePost(postId: string, userId: string, workspaceId?: string): Promise<{ mediaUrls: string[]; coverImageUrl?: string }>

    getPostsByDate(userId: string, workspaceId: string, fromDate: Date, toDate: Date): Promise<PostsByDateResponse>

    getPostsFailedCount(userId: string, workspaceId: string): Promise<number>

    getFailedPostTargets(userId: string, workspaceId: string): Promise<PostTargetEntity[]>

    retryPostTarget(
        userId: string,
        postId: string,
        socialAccountId: string
    ): Promise<{ postTarget: PostTargetResponse; post: CreatePostResponse }>

    deletePostTarget(userId: string, postId: string, socialAccountId: string): Promise<void>

    getPostsTargetedOnlyByAccount(userId: string, accountId: string): Promise<string[]>
}
