"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserInfoUseCase = void 0;
const getUserInfoUseCase = async (input, userService) => {
    return await userService.getUserInfo(input.userId);
};
exports.getUserInfoUseCase = getUserInfoUseCase;
