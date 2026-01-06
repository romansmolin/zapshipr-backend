"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceTagsController = void 0;
const inspirations_schemas_1 = require("../validation/inspirations.schemas");
class WorkspaceTagsController {
    constructor(tagsService, logger) {
        this.tagsService = tagsService;
        this.logger = logger;
    }
    async getTags(req, res) {
        const { workspaceId } = req.params;
        // Валидация query параметров
        const query = inspirations_schemas_1.GetTagsQuerySchema.parse(req.query);
        const result = await this.tagsService.getTags(workspaceId, query);
        res.status(200).json(result);
    }
    async createTag(req, res) {
        const { workspaceId } = req.params;
        // Валидация body
        const data = inspirations_schemas_1.CreateTagSchema.parse(req.body);
        const tag = await this.tagsService.createTag(workspaceId, data);
        res.status(201).json(tag);
    }
    async updateTag(req, res) {
        const { tagId } = req.params;
        // Валидация body
        const { name } = inspirations_schemas_1.UpdateTagSchema.parse(req.body);
        const tag = await this.tagsService.updateTag(tagId, name);
        res.status(200).json(tag);
    }
    async deleteTag(req, res) {
        const { tagId } = req.params;
        await this.tagsService.deleteTag(tagId);
        res.status(204).send();
    }
}
exports.WorkspaceTagsController = WorkspaceTagsController;
