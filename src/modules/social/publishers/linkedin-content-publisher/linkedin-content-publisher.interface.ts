import { PostTargetResponse } from "@/modules/post/types/posts.types";

export interface ILinkedinContentPublisherService {
	sendPostToLinkedin(
		postTarget: PostTargetResponse,
		userId: string,
		postId: string,
		mainCaption?: string
	): Promise<void>
}
