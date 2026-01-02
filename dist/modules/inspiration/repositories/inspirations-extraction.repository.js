"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspirationsExtractionRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const inspirations_extraction_schema_1 = require("../entity/inspirations-extraction.schema");
class InspirationsExtractionRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async create(data) {
        const [extraction] = await this.db
            .insert(inspirations_extraction_schema_1.inspirationsExtractions)
            .values(data)
            .returning();
        this.logger.info('Created inspiration extraction', {
            operation: 'InspirationsExtractionRepository.create',
            entity: 'inspirations_extractions',
            extractionId: extraction.id,
            rawInspirationId: extraction.rawInspirationId,
        });
        return extraction;
    }
    async findByRawInspirationId(rawInspirationId) {
        const [extraction] = await this.db
            .select()
            .from(inspirations_extraction_schema_1.inspirationsExtractions)
            .where((0, drizzle_orm_1.eq)(inspirations_extraction_schema_1.inspirationsExtractions.rawInspirationId, rawInspirationId))
            .limit(1);
        return extraction;
    }
    async findByWorkspaceId(workspaceId, limit = 20, offset = 0) {
        const extractions = await this.db
            .select()
            .from(inspirations_extraction_schema_1.inspirationsExtractions)
            .where((0, drizzle_orm_1.eq)(inspirations_extraction_schema_1.inspirationsExtractions.workspaceId, workspaceId))
            .orderBy((0, drizzle_orm_1.desc)(inspirations_extraction_schema_1.inspirationsExtractions.createdAt))
            .limit(limit)
            .offset(offset);
        return extractions;
    }
    async delete(id) {
        const result = await this.db
            .delete(inspirations_extraction_schema_1.inspirationsExtractions)
            .where((0, drizzle_orm_1.eq)(inspirations_extraction_schema_1.inspirationsExtractions.id, id))
            .returning();
        const deleted = result.length > 0;
        if (deleted) {
            this.logger.info('Deleted inspiration extraction', {
                operation: 'InspirationsExtractionRepository.delete',
                entity: 'inspirations_extractions',
                extractionId: id,
            });
        }
        return deleted;
    }
}
exports.InspirationsExtractionRepository = InspirationsExtractionRepository;
