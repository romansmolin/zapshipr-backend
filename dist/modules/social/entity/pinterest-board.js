"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinterestBoard = void 0;
class PinterestBoard {
    constructor(id, userId, socialAccountId, pinterestBoardId, name, description, ownerUsername, thumbnailUrl, privacy, createdAt, updatedAt) {
        this.id = id;
        this.userId = userId;
        this.socialAccountId = socialAccountId;
        this.pinterestBoardId = pinterestBoardId;
        this.name = name;
        this.description = description ?? null;
        this.ownerUsername = ownerUsername ?? null;
        this.thumbnailUrl = thumbnailUrl ?? null;
        this.privacy = privacy;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
exports.PinterestBoard = PinterestBoard;
