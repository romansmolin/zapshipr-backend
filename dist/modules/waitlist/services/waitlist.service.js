"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitlistService = void 0;
class WaitlistService {
    constructor(joinWaitlistUseCase) {
        this.joinWaitlistUseCase = joinWaitlistUseCase;
    }
    async joinWaitlist(payload) {
        return this.joinWaitlistUseCase.execute(payload);
    }
}
exports.WaitlistService = WaitlistService;
