"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadsContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
class ThreadsContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler) {
        this.THREADS_POLL_INTERVAL_MS = 5000;
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
    }
    async waitForThreadsContainerReady(mediaContainerId, accessToken) {
        while (true) {
            const response = await this.httpClient.get(`https://graph.threads.net/v1.0/${mediaContainerId}`, { params: { access_token: accessToken } });
            const status = response.status;
            this.logger.debug('Polled media container status', { status });
            switch (status) {
                case posts_types_1.ThreadsPostStatus.IN_PROGRESS:
                    await new Promise((resolve) => setTimeout(resolve, this.THREADS_POLL_INTERVAL_MS));
                    continue;
                case posts_types_1.ThreadsPostStatus.FINISHED:
                case posts_types_1.ThreadsPostStatus.PUBLISHED:
                    return status;
                case posts_types_1.ThreadsPostStatus.ERROR:
                    throw new base_error_1.BaseAppError(`Media container ${mediaContainerId} failed (ERROR)`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                case posts_types_1.ThreadsPostStatus.EXPIRED:
                    throw new base_error_1.BaseAppError(`Media container ${mediaContainerId} expired before publish`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
                default:
                    throw new base_error_1.BaseAppError(`Unknown status "${status}" for container ${mediaContainerId}`, error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
            }
        }
    }
    async publishReplies(replies, maxCount, pageId, accessToken, initialThreadId) {
        let lastThreadId = initialThreadId;
        this.logger.debug('REPLIES: ', {
            replies,
        });
        for (const replyText of replies.slice(0, maxCount)) {
            const replyCreation = await this.httpClient.post(`https://graph.threads.net/v1.0/${pageId}/threads`, {}, {
                params: {
                    access_token: accessToken,
                    media_type: posts_types_1.ThreadsMediaType.TEXT,
                    text: replyText,
                    reply_to_id: lastThreadId,
                },
            });
            await this.waitForThreadsContainerReady(replyCreation.id, accessToken);
            const replyPublish = await this.httpClient.post(`https://graph.threads.net/v1.0/${pageId}/threads_publish`, null, {
                params: {
                    access_token: accessToken,
                    creation_id: replyCreation.id,
                },
            });
            lastThreadId = replyPublish.id || lastThreadId;
        }
    }
    async sendPostToThreads(postTarget, userId, postId, mainCaption, post) {
        try {
            const { accessToken, pageId } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const mediaAssets = await this.postRepository.getPostMediaAssets(postId);
            let creationId;
            if (mediaAssets.length === 0) {
                const response = await this.httpClient.post(`https://graph.threads.net/v1.0/${pageId}/threads`, {
                    ...(postTarget?.tags && postTarget.tags.length > 0 && { topic_tag: postTarget.tags[0] }),
                    ...(postTarget?.links &&
                        postTarget.links.length > 0 && { link_attachment: postTarget.links[0] }),
                }, {
                    params: {
                        access_token: accessToken,
                        media_type: posts_types_1.ThreadsMediaType.TEXT,
                        text: postTarget.text || mainCaption || '',
                    },
                });
                creationId = response.id;
            }
            else if (mediaAssets.length === 1) {
                const mediaAsset = mediaAssets[0];
                const mediaType = mediaAsset.type?.startsWith('image')
                    ? posts_types_1.ThreadsMediaType.IMAGE
                    : mediaAsset.type?.startsWith('video')
                        ? posts_types_1.ThreadsMediaType.VIDEO
                        : posts_types_1.ThreadsMediaType.TEXT;
                const response = await this.httpClient.post(`https://graph.threads.net/v1.0/${pageId}/threads`, {
                    ...(postTarget?.tags && postTarget.tags.length > 0 && { topic_tag: postTarget.tags[0] }),
                    ...(postTarget?.links &&
                        postTarget.links.length > 0 && { link_attachment: postTarget.links[0] }),
                }, {
                    params: {
                        access_token: accessToken,
                        media_type: mediaType,
                        text: postTarget.text || mainCaption || '',
                        ...(mediaType === posts_types_1.ThreadsMediaType.IMAGE ? { image_url: mediaAsset.url } : {}),
                        ...(mediaType === posts_types_1.ThreadsMediaType.VIDEO ? { video_url: mediaAsset.url } : {}),
                    },
                });
                creationId = response.id;
            }
            else {
                if (mediaAssets.length > 10) {
                    throw new base_error_1.BaseAppError('Threads carousel supports maximum 10 images', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const hasVideo = mediaAssets.some((asset) => asset.type?.startsWith('video'));
                if (hasVideo) {
                    throw new base_error_1.BaseAppError('Threads carousel only supports images, not videos', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const mediaContainerIds = [];
                for (const mediaAsset of mediaAssets) {
                    const response = await this.httpClient.post(`https://graph.threads.net/v1.0/${pageId}/threads`, {
                        ...(postTarget?.tags &&
                            postTarget.tags.length > 0 && { topic_tag: postTarget.tags[0] }),
                        ...(postTarget?.links &&
                            postTarget.links.length > 0 && { link_attachment: postTarget.links[0] }),
                    }, {
                        params: {
                            access_token: accessToken,
                            media_type: posts_types_1.ThreadsMediaType.IMAGE,
                            image_url: mediaAsset.url,
                            is_carousel_item: true,
                        },
                    });
                    mediaContainerIds.push(response.id);
                }
                await Promise.all(mediaContainerIds.map((containerId) => this.waitForThreadsContainerReady(containerId, accessToken)));
                const carouselResponse = await this.httpClient.post(`https://graph.threads.net/v1.0/${pageId}/threads`, {
                    ...(postTarget?.tags && postTarget.tags.length > 0 && { topic_tag: postTarget.tags[0] }),
                    ...(postTarget?.links &&
                        postTarget.links.length > 0 && { link_attachment: postTarget.links[0] }),
                }, {
                    params: {
                        access_token: accessToken,
                        media_type: posts_types_1.ThreadsMediaType.CAROUSEL,
                        text: postTarget.text || mainCaption || '',
                        children: mediaContainerIds.join(','),
                    },
                });
                creationId = carouselResponse.id;
            }
            this.logger.debug('Media container created', { creationId });
            await this.waitForThreadsContainerReady(creationId, accessToken);
            const postRes = await this.httpClient.post(`https://graph.threads.net/v1.0/${pageId}/threads_publish`, null, {
                params: {
                    access_token: accessToken,
                    creation_id: creationId,
                },
            });
            const replies = postTarget.threadsReplies || [];
            await this.publishReplies(replies, Math.min(replies.length, 10), pageId, accessToken, postRes.id);
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('Threads post published successfully', {
                operation: 'sendPostToThreads',
                userId,
                postId,
                threadsPostId: postRes.id,
                mediaCount: mediaAssets.length,
                mediaType: mediaAssets.length > 1 ? 'carousel' : mediaAssets.length === 1 ? 'single' : 'text',
                replyCount: replies.length,
            });
            return await this.postRepository.getPostDetails(postId, userId);
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'threads', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
}
exports.ThreadsContentPublisherService = ThreadsContentPublisherService;
