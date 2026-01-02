"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostTargetEntity = void 0;
class PostTargetEntity {
    constructor(postId, socialAccountId, platform, status, errorMessage, text, title, pinterestBoardId, userId) {
        this.postId = postId;
        this.socialAccountId = socialAccountId;
        this.platform = platform;
        this.status = status;
        this.errorMessage = errorMessage;
        this.text = text;
        this.title = title;
        this.pinterestBoardId = pinterestBoardId;
        this.userId = userId;
    }
}
exports.PostTargetEntity = PostTargetEntity;
