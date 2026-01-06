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
    async getDefault(req, res) {
        const userId = req.user.id;
        this.logger.info('Get default workspace request', { userId });
        const workspace = await this.service.getDefaultWorkspace(userId);
        if (!workspace) {
            res.status(404).json({ message: 'No workspaces found' });
            return;
        }
        res.json(workspace);
    }
    async setAsDefault(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        this.logger.info('Set workspace as default request', { userId, workspaceId: id });
        const workspace = await this.service.setDefaultWorkspace(id, userId);
        res.json(workspace);
    }
}
exports.WorkspaceController = WorkspaceController;
