import { Account } from "@/modules/social/entity/account";
import { IAccountRepository } from "@/modules/social/repositories/account-repository.interface";
import { IAccountsService } from "@/modules/social/services/accounts.service.interface";
import { ErrorCode } from "@/shared/consts/error-codes.const";
import { BaseAppError } from "@/shared/errors/base-error";
import type { SocialAccountResponse } from "@/modules/social/entity/social-account.dto";

export const upsertAccount = async (
    account: Account,
    _accountRepository: IAccountRepository,
    accountsService: IAccountsService
): Promise<{ isNew: boolean; account: SocialAccountResponse }> => {
    try {
        return await accountsService.connectAccount(account)
    } catch (err: unknown) {
        throw new BaseAppError(`Failed to upsert account: ${account.id}`, ErrorCode.BAD_REQUEST, 500)
    }
}
