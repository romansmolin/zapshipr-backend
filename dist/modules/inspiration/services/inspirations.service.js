"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspirationsService = void 0;
const app_error_1 = require("@/shared/errors/app-error");
const inspirations_schemas_1 = require("../validation/inspirations.schemas");
class InspirationsService {
    constructor(inspirationsRepository, mediaUploader, inspirationScheduler, logger) {
        this.inspirationsRepository = inspirationsRepository;
        this.mediaUploader = mediaUploader;
        this.inspirationScheduler = inspirationScheduler;
        this.logger = logger;
    }
    async createInspiration(data) {
        // Валидация в зависимости от типа
        if (data.type === 'link' || data.type === 'text') {
            (0, inspirations_schemas_1.validateInspirationByType)({ type: data.type, content: data.content });
        }
        // Проверка дубликатов для ссылок
        if (data.type === 'link' && data.content) {
            const isDuplicate = await this.inspirationsRepository.checkDuplicateUrl(data.workspaceId, data.content);
            if (isDuplicate) {
                throw new app_error_1.AppError({
                    errorMessageCode: app_error_1.ErrorMessageCode.DUPLICATE_INSPIRATION,
                    message: 'This URL already exists in your inspirations',
                    httpCode: 409,
                });
            }
        }
        // Загрузка файла в S3 (если type=image или document)
        let imageUrl;
        if (data.file && (data.type === 'image' || data.type === 'document')) {
            const timestamp = Date.now();
            const fileName = `${data.workspaceId}/${data.type}s/${timestamp}-${data.file.originalname}`;
            imageUrl = await this.mediaUploader.upload({
                key: fileName,
                body: data.file.buffer,
                contentType: data.file.mimetype,
            });
            this.logger.info('Uploaded inspiration file to S3', {
                operation: 'InspirationsService.createInspiration',
                workspaceId: data.workspaceId,
                type: data.type,
                imageUrl,
            });
        }
        // Создание inspiration
        const inspiration = await this.inspirationsRepository.create({
            workspaceId: data.workspaceId,
            userId: data.userId,
            type: data.type,
            content: data.content,
            imageUrl,
            userDescription: data.userDescription,
            status: 'processing',
        });
        this.logger.info('Created inspiration', {
            operation: 'InspirationsService.createInspiration',
            inspirationId: inspiration.id,
            workspaceId: data.workspaceId,
            type: data.type,
        });
        // Добавить задачу в очередь для обработки
        await this.inspirationScheduler.scheduleInspiration(inspiration.id, data.workspaceId, data.userId);
        this.logger.info('Scheduled inspiration for processing', {
            operation: 'InspirationsService.createInspiration',
            inspirationId: inspiration.id,
        });
        return inspiration;
    }
    async getInspirations(workspaceId, filters) {
        const { items, total } = await this.inspirationsRepository.findByWorkspaceId(workspaceId, filters);
        return {
            items,
            total,
            limit: filters?.limit ?? 20,
            offset: filters?.offset ?? 0,
        };
    }
    async getInspirationById(id) {
        const inspiration = await this.inspirationsRepository.findById(id);
        return inspiration ?? null;
    }
    async updateInspiration(id, userDescription) {
        const inspiration = await this.inspirationsRepository.findById(id);
        if (!inspiration) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            });
        }
        const updated = await this.inspirationsRepository.update(id, { userDescription });
        this.logger.info('Updated inspiration', {
            operation: 'InspirationsService.updateInspiration',
            inspirationId: id,
        });
        return updated ?? null;
    }
    async deleteInspiration(id) {
        const inspiration = await this.inspirationsRepository.findById(id);
        if (!inspiration) {
            throw new app_error_1.AppError({
                errorMessageCode: app_error_1.ErrorMessageCode.INSPIRATION_NOT_FOUND,
                message: 'Inspiration not found',
                httpCode: 404,
            });
        }
        // Удаление файла из S3 (если есть)
        if (inspiration.imageUrl) {
            try {
                await this.mediaUploader.delete(inspiration.imageUrl);
                this.logger.info('Deleted inspiration file from S3', {
                    operation: 'InspirationsService.deleteInspiration',
                    inspirationId: id,
                    imageUrl: inspiration.imageUrl,
                });
            }
            catch (error) {
                // Ошибка удаления из S3 не должна блокировать удаление из БД
                this.logger.warn('Failed to delete file from S3, continuing with DB deletion', {
                    operation: 'InspirationsService.deleteInspiration',
                    inspirationId: id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        const deleted = await this.inspirationsRepository.delete(id);
        this.logger.info('Deleted inspiration', {
            operation: 'InspirationsService.deleteInspiration',
            inspirationId: id,
        });
        return deleted;
    }
}
exports.InspirationsService = InspirationsService;
