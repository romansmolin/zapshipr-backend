"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const user_dto_1 = require("@/modules/user/entity/user.dto");
class UserController {
    constructor(userService, logger) {
        this.userService = userService;
        this.logger = logger;
    }
    async getUserInfo(req, res, next) {
        const userId = this.getUserId(req);
        const userInfo = await this.userService.getUserInfo(userId);
        res.json({
            user: (0, user_dto_1.toUserResponse)(userInfo.user),
            planName: userInfo.planName,
            userWorkspaces: userInfo.userWorkspaces,
        });
    }
    getUserId(req) {
        const userId = req.user?.id;
        if (!userId) {
            throw new base_error_1.BaseAppError('Unauthorized', error_codes_const_1.ErrorCode.UNAUTHORIZED, 401);
        }
        return userId;
    }
}
exports.UserController = UserController;
