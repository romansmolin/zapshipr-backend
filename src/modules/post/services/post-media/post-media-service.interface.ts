import type {
    CreatePostsRequest,
    MediaTransformRequest,
    UploadedMediaRequest,
} from '@/modules/post/schemas/posts.schemas'
import type {
    MediaCompatibilityError,
    PostPreparationJobPayload,
} from '../posts/posts-service.interface'

type MediaInput = Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined

export interface IPostMediaService {
    extractUploadedMediaFiles(medias: MediaInput): Express.Multer.File[]

    getMediaTransforms(createPostsRequest: CreatePostsRequest): MediaTransformRequest[]

    collectSelectedMediaIndices(posts: CreatePostsRequest['posts']): Set<number>

    normalizePostTargetsMediaIndices(
        request: CreatePostsRequest,
        mediaCount: number
    ): CreatePostsRequest['posts']

    getSingleEditTransform(
        updatePostRequest: CreatePostsRequest,
        selectedMediaIndices: Set<number>,
        file?: Express.Multer.File
    ): MediaTransformRequest | null

    validateMediaCompatibility(
        createPostsRequest: CreatePostsRequest,
        medias: MediaInput
    ): MediaCompatibilityError | null

    uploadAndSaveMediaFiles(
        medias: MediaInput,
        userId: string,
        postId: string,
        createPostsRequest: CreatePostsRequest,
        copyDataUrls?: string[] | null,
        selectedMediaIndices?: Set<number>
    ): Promise<void>

    saveUploadedMediaReferences(
        uploadedMedia: UploadedMediaRequest[],
        userId: string,
        postId: string,
        orderCounter: number
    ): Promise<number>

    saveCopyMediaReferences(
        copyDataUrls: string[] | null | undefined,
        userId: string,
        postId: string,
        orderCounter: number
    ): Promise<number>

    attachMediaReferencesForAsyncPostNow(
        medias: MediaInput,
        request: CreatePostsRequest,
        userId: string,
        postId: string
    ): Promise<void>

    applyMediaTransformsToStoredAssets(payload: PostPreparationJobPayload): Promise<void>
}
