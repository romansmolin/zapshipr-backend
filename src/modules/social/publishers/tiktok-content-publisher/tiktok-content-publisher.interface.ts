import { CreatePostResponse, PostTargetResponse } from "@/modules/post/types/posts.types";

export interface ITikTokContentPublisherService {
	sendPostToTikTok(
		postTarget: PostTargetResponse,
		userId: string,
		postId: string,
		mainCaption?: string,
		post?: CreatePostResponse
	): Promise<void>
}
