import { PostTargetResponse } from "@/modules/post/types/posts.types";

export interface IYouTubeContentPublisherService {
	sendPostToYouTube(
		postTarget: PostTargetResponse,
		userId: string,
		postId: string,
		mainCaption?: string
	): Promise<void>
}
