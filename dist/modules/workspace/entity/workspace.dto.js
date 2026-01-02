"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWorkspaceDto = void 0;
const toWorkspaceDto = (workspace) => ({
    id: workspace.id,
    userId: workspace.userId,
    name: workspace.name,
    description: workspace.description,
    avatarUrl: workspace.avatarUrl,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
});
exports.toWorkspaceDto = toWorkspaceDto;
