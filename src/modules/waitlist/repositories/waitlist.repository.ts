import { and, eq, isNull, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { schema as dbSchema } from '@/db/schema'
import { ErrorCode } from '@/shared/consts/error-codes.const'
import { BaseAppError } from '@/shared/errors/base-error'
import type { ILogger } from '@/shared/logger/logger.interface'
import { formatError } from '@/shared/utils/forma-error'

import { WaitlistEntry } from '@/modules/waitlist/entity/waitlist-entry'
import { toWaitlistEntry } from '@/modules/waitlist/entity/waitlist.mappers'
import { waitlistEntries } from '@/modules/waitlist/entity/waitlist.schema'

import type { IWaitlistRepository } from './waitlist.repository.interface'

export class WaitlistRepository implements IWaitlistRepository {
    private readonly db: NodePgDatabase<typeof dbSchema>
    private readonly logger: ILogger

    constructor(db: NodePgDatabase<typeof dbSchema>, logger: ILogger) {
        this.db = db
        this.logger = logger
    }

    async createEntry(entry: WaitlistEntry): Promise<WaitlistEntry | null> {
        try {
            const [row] = await this.db
                .insert(waitlistEntries)
                .values({
                    id: entry.id,
                    email: entry.email,
                    emailNormalized: entry.emailNormalized,
                    status: entry.status,
                    referralCode: entry.referralCode,
                })
                .onConflictDoNothing({
                    target: waitlistEntries.emailNormalized,
                })
                .returning()

            if (!row) {
                return null
            }

            return toWaitlistEntry(row)
        } catch (error) {
            this.logger.error('Failed to create waitlist entry', {
                operation: 'WaitlistRepository.createEntry',
                error: formatError(error),
            })
            throw new BaseAppError('Failed to create waitlist entry', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async findByEmailNormalized(emailNormalized: string): Promise<WaitlistEntry | null> {
        try {
            const [row] = await this.db
                .select()
                .from(waitlistEntries)
                .where(eq(waitlistEntries.emailNormalized, emailNormalized))
                .limit(1)

            return row ? toWaitlistEntry(row) : null
        } catch (error) {
            this.logger.error('Failed to find waitlist entry by email', {
                operation: 'WaitlistRepository.findByEmailNormalized',
                error: formatError(error),
            })
            throw new BaseAppError('Failed to find waitlist entry by email', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async findByReferralCode(referralCode: string): Promise<WaitlistEntry | null> {
        try {
            const [row] = await this.db
                .select()
                .from(waitlistEntries)
                .where(eq(waitlistEntries.referralCode, referralCode))
                .limit(1)

            return row ? toWaitlistEntry(row) : null
        } catch (error) {
            this.logger.error('Failed to find waitlist entry by referral code', {
                operation: 'WaitlistRepository.findByReferralCode',
                error: formatError(error),
            })
            throw new BaseAppError('Failed to find waitlist entry by referral code', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async findById(entryId: string): Promise<WaitlistEntry | null> {
        try {
            const [row] = await this.db
                .select()
                .from(waitlistEntries)
                .where(eq(waitlistEntries.id, entryId))
                .limit(1)

            return row ? toWaitlistEntry(row) : null
        } catch (error) {
            this.logger.error('Failed to find waitlist entry by id', {
                operation: 'WaitlistRepository.findById',
                error: formatError(error),
            })
            throw new BaseAppError('Failed to find waitlist entry by id', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async applyReferral(params: { referrerId: string; referredEntryId: string }): Promise<boolean> {
        try {
            const [updated] = await this.db
                .update(waitlistEntries)
                .set({
                    referredById: params.referrerId,
                    referredAt: new Date(),
                })
                .where(and(eq(waitlistEntries.id, params.referredEntryId), isNull(waitlistEntries.referredById)))
                .returning({ id: waitlistEntries.id })

            return Boolean(updated)
        } catch (error) {
            this.logger.error('Failed to apply waitlist referral', {
                operation: 'WaitlistRepository.applyReferral',
                error: formatError(error),
            })
            throw new BaseAppError('Failed to apply waitlist referral', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }

    async countReferrals(referrerId: string): Promise<number> {
        try {
            const [row] = await this.db
                .select({
                    total: sql<number>`count(*)`,
                })
                .from(waitlistEntries)
                .where(eq(waitlistEntries.referredById, referrerId))

            return Number(row?.total ?? 0)
        } catch (error) {
            this.logger.error('Failed to count waitlist referrals', {
                operation: 'WaitlistRepository.countReferrals',
                error: formatError(error),
            })
            throw new BaseAppError('Failed to count referrals', ErrorCode.UNKNOWN_ERROR, 500)
        }
    }
}
