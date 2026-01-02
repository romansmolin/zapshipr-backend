"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserInfoUseCase = void 0;
const getUserInfoUseCase = async (input, userService) => {
    const user = await userService.getUserInfo(input.userId);
    return { user };
};
exports.getUserInfoUseCase = getUserInfoUseCase;
