"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedinContentPublisherService = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const posts_types_1 = require("@/modules/post/types/posts.types");
class LinkedinContentPublisherService {
    constructor(logger, accountRepository, postRepository, httpClient, socialMediaErrorHandler) {
        this.logger = logger;
        this.accountRepository = accountRepository;
        this.postRepository = postRepository;
        this.httpClient = httpClient;
        this.socialMediaErrorHandler = socialMediaErrorHandler;
    }
    async sendPostToLinkedin(postTarget, userId, postId, mainCaption) {
        try {
            const { accessToken, pageId: linkedinUserId } = await this.accountRepository.getAccountByUserIdAndSocialAccountId(userId, postTarget.socialAccountId);
            const mediaAssets = await this.postRepository.getPostMediaAssets(postId);
            const text = postTarget.text || mainCaption || '';
            if (mediaAssets.length === 0) {
                await this.createLinkedInTextPost(accessToken, text, linkedinUserId);
            }
            else if (mediaAssets.length === 1) {
                const mediaAsset = mediaAssets[0];
                if (mediaAsset.type?.startsWith('video')) {
                    await this.createLinkedInVideoPost(accessToken, text, mediaAsset.url, userId, postId, linkedinUserId);
                }
                else {
                    await this.createLinkedInImagePost(accessToken, text, [mediaAsset.url], userId, postId, linkedinUserId);
                }
            }
            else {
                const hasVideo = mediaAssets.some((asset) => asset.type?.startsWith('video'));
                if (hasVideo) {
                    throw new base_error_1.BaseAppError('LinkedIn carousel posts only support images, not videos', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                if (mediaAssets.length > 9) {
                    throw new base_error_1.BaseAppError('LinkedIn supports maximum 9 images in a carousel post', error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
                }
                const imageUrls = mediaAssets.map((asset) => asset.url);
                await this.createLinkedInImagePost(accessToken, text, imageUrls, userId, postId, linkedinUserId);
            }
            await this.postRepository.updatePostTarget(userId, postId, postTarget.socialAccountId, posts_types_1.PostStatus.DONE);
            this.logger.info('LinkedIn post created successfully', {
                operation: 'sendPostToLinkedin',
                userId,
                postId,
                mediaCount: mediaAssets.length,
                hasVideo: mediaAssets.some((asset) => asset.type?.startsWith('video')),
            });
        }
        catch (error) {
            const errorResult = await this.socialMediaErrorHandler.handleSocialMediaError(error, 'linkedin', userId, postId, postTarget.socialAccountId);
            throw errorResult.error;
        }
    }
    async createLinkedInTextPost(accessToken, text, linkedinUserId) {
        const authorUrn = `urn:li:person:${linkedinUserId}`;
        const payload = {
            author: authorUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text,
                    },
                    shareMediaCategory: 'NONE',
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };
        await this.httpClient.post('https://api.linkedin.com/v2/ugcPosts', payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
        });
    }
    async createLinkedInImagePost(accessToken, text, imageUrls, userId, postId, linkedinUserId) {
        const ownerUrn = `urn:li:person:${linkedinUserId}`;
        const uploadedAssets = [];
        for (const [index, imageUrl] of imageUrls.entries()) {
            try {
                const imageResponse = await this.httpClient.get(imageUrl, {
                    responseType: 'arraybuffer',
                });
                const imageBuffer = Buffer.isBuffer(imageResponse) ? imageResponse : Buffer.from(imageResponse);
                const registerResponse = await this.httpClient.post('https://api.linkedin.com/v2/assets?action=registerUpload', {
                    registerUploadRequest: {
                        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                        owner: ownerUrn,
                        serviceRelationships: [
                            {
                                relationshipType: 'OWNER',
                                identifier: 'urn:li:userGeneratedContent',
                            },
                        ],
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                const uploadUrl = registerResponse.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
                const asset = registerResponse.value.asset;
                await this.httpClient.put(uploadUrl, imageBuffer, {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
                });
                uploadedAssets.push(asset);
                this.logger.debug('LinkedIn image uploaded successfully', {
                    operation: 'createLinkedInImagePost',
                    userId,
                    postId,
                    imageIndex: index,
                    asset,
                });
            }
            catch (error) {
                this.logger.error('Failed to upload image to LinkedIn', {
                    operation: 'createLinkedInImagePost',
                    userId,
                    postId,
                    imageIndex: index,
                    imageUrl,
                    error: {
                        name: error instanceof Error ? error.name : 'Unknown Error',
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
                throw error;
            }
        }
        const payload = {
            author: ownerUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text,
                    },
                    shareMediaCategory: 'IMAGE',
                    media: uploadedAssets.map((asset) => ({
                        status: 'READY',
                        description: {
                            text,
                        },
                        media: asset,
                        title: {
                            text: 'Shared via ZapShipr',
                        },
                    })),
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };
        await this.httpClient.post('https://api.linkedin.com/v2/ugcPosts', payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
        });
    }
    async createLinkedInVideoPost(accessToken, text, videoUrl, userId, postId, linkedinUserId) {
        try {
            const ownerUrn = `urn:li:person:${linkedinUserId}`;
            const videoResponse = await this.httpClient.get(videoUrl, { responseType: 'arraybuffer' });
            const videoBuffer = Buffer.isBuffer(videoResponse) ? videoResponse : Buffer.from(videoResponse);
            const registerResponse = await this.httpClient.post('https://api.linkedin.com/v2/assets?action=registerUpload', {
                registerUploadRequest: {
                    recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
                    owner: ownerUrn,
                    serviceRelationships: [
                        {
                            relationshipType: 'OWNER',
                            identifier: 'urn:li:userGeneratedContent',
                        },
                    ],
                },
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const uploadUrl = registerResponse.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
            const asset = registerResponse.value.asset;
            await this.httpClient.put(uploadUrl, videoBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
            });
            this.logger.debug('LinkedIn video uploaded successfully', {
                operation: 'createLinkedInVideoPost',
                userId,
                postId,
                asset,
                videoSize: videoBuffer.length,
            });
            const payload = {
                author: ownerUrn,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text,
                        },
                        shareMediaCategory: 'VIDEO',
                        media: [
                            {
                                status: 'READY',
                                description: {
                                    text,
                                },
                                media: asset,
                                title: {
                                    text: 'Video shared via ZapShipr',
                                },
                            },
                        ],
                    },
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                },
            };
            await this.httpClient.post('https://api.linkedin.com/v2/ugcPosts', payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                },
            });
        }
        catch (error) {
            this.logger.error('Failed to create LinkedIn video post', {
                operation: 'createLinkedInVideoPost',
                userId,
                postId,
                videoUrl,
                error: {
                    name: error instanceof Error ? error.name : 'Unknown Error',
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw error;
        }
    }
}
exports.LinkedinContentPublisherService = LinkedinContentPublisherService;
