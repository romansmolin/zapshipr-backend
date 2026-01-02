import { PostTargetResponse } from "@/modules/post/types/posts.types";

export interface IFacebookContentPublisherService {
	sendPostToFacebook(
		postTarget: PostTargetResponse,
		userId: string,
		postId: string,
		mainCaption?: string
	): Promise<void>
}
