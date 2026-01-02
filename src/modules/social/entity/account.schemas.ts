import type { Account } from '@/modules/social/entity/account'
import { accountSchema, type SocialAccountResponse, toAccountResponse } from '@/modules/social/entity/social-account.dto'
import type { SocialAccount } from '@/modules/social/entity/social-account.schema'

export { accountSchema }

export type AccountSchema = SocialAccountResponse

export const transformAccounts = (accounts: Array<SocialAccount | Account>): AccountSchema[] => {
    return accounts.map((account) => toAccountResponse(account as SocialAccount))
}
