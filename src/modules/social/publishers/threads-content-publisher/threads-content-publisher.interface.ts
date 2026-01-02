import { CreatePostResponse, IPost, PostTargetResponse } from "@/modules/post/types/posts.types";

export interface IThreadsContentPublisherService {
	sendPostToThreads(
		postTarget: PostTargetResponse,
		userId: string,
		postId: string,
		mainCaption?: string,
		post?: CreatePostResponse
	): Promise<IPost | null>
}
