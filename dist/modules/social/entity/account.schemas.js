"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformAccounts = exports.accountSchema = void 0;
const social_account_dto_1 = require("@/modules/social/entity/social-account.dto");
Object.defineProperty(exports, "accountSchema", { enumerable: true, get: function () { return social_account_dto_1.accountSchema; } });
const transformAccounts = (accounts) => {
    return accounts.map((account) => (0, social_account_dto_1.toAccountResponse)(account));
};
exports.transformAccounts = transformAccounts;
