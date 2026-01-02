"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceController = void 0;
const workspace_schemas_1 = require("../validation/workspace.schemas");
class WorkspaceController {
    constructor(service, logger) {
        this.service = service;
        this.logger = logger;
    }
    async create(req, res) {
        const userId = req.user.id;
        const body = workspace_schemas_1.createWorkspaceSchema.parse(req.body);
        this.logger.info('Create workspace request', { userId });
        const workspace = await this.service.create(userId, body);
        res.status(201).json(workspace);
    }
    async getById(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        this.logger.info('Get workspace by id request', { userId, workspaceId: id });
        const workspace = await this.service.getById(id, userId);
        res.json(workspace);
    }
    async getAll(req, res) {
        const userId = req.user.id;
        this.logger.info('Get all workspaces request', { userId });
        const workspaces = await this.service.getByUserId(userId);
        res.json(workspaces);
    }
    async update(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        const body = workspace_schemas_1.updateWorkspaceSchema.parse(req.body);
        this.logger.info('Update workspace request', { userId, workspaceId: id });
        const workspace = await this.service.update(id, userId, body);
        res.json(workspace);
    }
    async delete(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        this.logger.info('Delete workspace request', { userId, workspaceId: id });
        await this.service.delete(id, userId);
        res.status(204).send();
    }
    async updateAvatar(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'No file provided' });
            return;
        }
        this.logger.info('Update workspace avatar request', { userId, workspaceId: id });
        const workspace = await this.service.updateAvatar(id, userId, file);
        res.json(workspace);
    }
    async getMainPrompt(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        this.logger.info('Get main prompt request', { userId, workspaceId: id });
        const mainPrompt = await this.service.getMainPrompt(id, userId);
        res.json(mainPrompt);
    }
    async updateMainPrompt(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        this.logger.info('Update main prompt request', { userId, workspaceId: id });
        const mainPrompt = await this.service.updateMainPrompt(id, userId, req.body);
        res.json(mainPrompt);
    }
}
exports.WorkspaceController = WorkspaceController;
