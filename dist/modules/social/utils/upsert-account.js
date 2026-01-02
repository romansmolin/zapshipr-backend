"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertAccount = void 0;
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const upsertAccount = async (account, _accountRepository, accountsService) => {
    try {
        return await accountsService.connectAccount(account);
    }
    catch (err) {
        throw new base_error_1.BaseAppError(`Failed to upsert account: ${account.id}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 500);
    }
};
exports.upsertAccount = upsertAccount;
