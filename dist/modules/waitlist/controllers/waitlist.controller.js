"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitlistController = void 0;
const waitlist_schemas_1 = require("@/modules/waitlist/validation/waitlist.schemas");
class WaitlistController {
    constructor(waitlistService, logger) {
        this.waitlistService = waitlistService;
        this.logger = logger;
    }
    async join(req, res, next) {
        const payload = waitlist_schemas_1.joinWaitlistSchema.parse(req.body);
        const result = await this.waitlistService.joinWaitlist(payload);
        this.logger.info('Waitlist join request handled', {
            operation: 'WaitlistController.join',
            email: payload.email,
            status: result.status,
        });
        res.json(result);
    }
}
exports.WaitlistController = WaitlistController;
