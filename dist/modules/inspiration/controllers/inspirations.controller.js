"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspirationsController = void 0;
const app_error_1 = require("@/shared/errors/app-error");
const inspirations_schemas_1 = require("../validation/inspirations.schemas");
class InspirationsController {
    constructor(service, logger) {
        this.service = service;
        this.logger = logger;
    }
    async create(req, res) {
        const userId = req.user.id;
        const { workspaceId } = req.params;
        const body = inspirations_schemas_1.CreateInspirationSchema.parse(req.body);
        const file = req.file;
        this.logger.info('Create inspiration request', { userId, workspaceId, type: body.type });
        // Валидация файла для type=image или document
        if ((body.type === 'image' || body.type === 'document') && !file) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                message: `File is required for type=${body.type}`,
                httpCode: 400,
            });
        }
        // Валидация content для type=link или text
        if ((body.type === 'link' || body.type === 'text') && !body.content) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.VALIDATION_ERROR,
                message: `content is required for type=${body.type}`,
                httpCode: 400,
            });
        }
        const inspiration = await this.service.createInspiration({
            workspaceId,
            userId,
            type: body.type,
            content: body.content,
            userDescription: body.userDescription,
            file,
        });
        res.status(201).json(inspiration);
    }
    async getAll(req, res) {
        const userId = req.user.id;
        const { workspaceId } = req.params;
        const query = inspirations_schemas_1.GetInspirationsQuerySchema.parse(req.query);
        this.logger.info('Get inspirations request', { userId, workspaceId });
        const result = await this.service.getInspirations(workspaceId, query);
        res.json(result);
    }
    async getById(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        this.logger.info('Get inspiration by id request', { userId, inspirationId: id });
        const inspiration = await this.service.getInspirationById(id);
        if (!inspiration) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            });
        }
        res.json(inspiration);
    }
    async update(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        const body = inspirations_schemas_1.UpdateInspirationSchema.parse(req.body);
        this.logger.info('Update inspiration request', { userId, inspirationId: id });
        const inspiration = await this.service.updateInspiration(id, body.userDescription);
        res.json(inspiration);
    }
    async delete(req, res) {
        const userId = req.user.id;
        const { id } = req.params;
        this.logger.info('Delete inspiration request', { userId, inspirationId: id });
        await this.service.deleteInspiration(id);
        res.status(204).send();
    }
}
exports.InspirationsController = InspirationsController;
