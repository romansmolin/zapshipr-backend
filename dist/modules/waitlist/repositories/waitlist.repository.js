"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitlistRepository = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const base_error_1 = require("@/shared/errors/base-error");
const forma_error_1 = require("@/shared/utils/forma-error");
const waitlist_mappers_1 = require("@/modules/waitlist/entity/waitlist.mappers");
const waitlist_schema_1 = require("@/modules/waitlist/entity/waitlist.schema");
const REFERRAL_CONFLICT = 'WAITLIST_REFERRAL_CONFLICT';
class WaitlistRepository {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }
    async createEntry(entry) {
        try {
            const [row] = await this.db
                .insert(waitlist_schema_1.waitlistEntries)
                .values({
                id: entry.id,
                email: entry.email,
                emailNormalized: entry.emailNormalized,
                status: entry.status,
                referralCode: entry.referralCode,
            })
                .onConflictDoNothing({
                target: waitlist_schema_1.waitlistEntries.emailNormalized,
            })
                .returning();
            if (!row) {
                return null;
            }
            return (0, waitlist_mappers_1.toWaitlistEntry)(row);
        }
        catch (error) {
            this.logger.error('Failed to create waitlist entry', {
                operation: 'WaitlistRepository.createEntry',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to create waitlist entry', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async findByEmailNormalized(emailNormalized) {
        try {
            const [row] = await this.db
                .select()
                .from(waitlist_schema_1.waitlistEntries)
                .where((0, drizzle_orm_1.eq)(waitlist_schema_1.waitlistEntries.emailNormalized, emailNormalized))
                .limit(1);
            return row ? (0, waitlist_mappers_1.toWaitlistEntry)(row) : null;
        }
        catch (error) {
            this.logger.error('Failed to find waitlist entry by email', {
                operation: 'WaitlistRepository.findByEmailNormalized',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to find waitlist entry by email', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async findByReferralCode(referralCode) {
        try {
            const [row] = await this.db
                .select()
                .from(waitlist_schema_1.waitlistEntries)
                .where((0, drizzle_orm_1.eq)(waitlist_schema_1.waitlistEntries.referralCode, referralCode))
                .limit(1);
            return row ? (0, waitlist_mappers_1.toWaitlistEntry)(row) : null;
        }
        catch (error) {
            this.logger.error('Failed to find waitlist entry by referral code', {
                operation: 'WaitlistRepository.findByReferralCode',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to find waitlist entry by referral code', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async findById(entryId) {
        try {
            const [row] = await this.db
                .select()
                .from(waitlist_schema_1.waitlistEntries)
                .where((0, drizzle_orm_1.eq)(waitlist_schema_1.waitlistEntries.id, entryId))
                .limit(1);
            return row ? (0, waitlist_mappers_1.toWaitlistEntry)(row) : null;
        }
        catch (error) {
            this.logger.error('Failed to find waitlist entry by id', {
                operation: 'WaitlistRepository.findById',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to find waitlist entry by id', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async applyReferral(params) {
        try {
            const result = await this.db.transaction(async (tx) => {
                const [updated] = await tx
                    .update(waitlist_schema_1.waitlistEntries)
                    .set({
                    referredById: params.referrerId,
                    referredAt: new Date(),
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(waitlist_schema_1.waitlistEntries.id, params.referredEntryId), (0, drizzle_orm_1.isNull)(waitlist_schema_1.waitlistEntries.referredById)))
                    .returning({ id: waitlist_schema_1.waitlistEntries.id });
                if (!updated) {
                    return false;
                }
                const [eventRow] = await tx
                    .insert(waitlist_schema_1.waitlistReferralEvents)
                    .values({
                    referrerId: params.referrerId,
                    referredEntryId: params.referredEntryId,
                })
                    .onConflictDoNothing({ target: waitlist_schema_1.waitlistReferralEvents.referredEntryId })
                    .returning({ id: waitlist_schema_1.waitlistReferralEvents.id });
                if (!eventRow) {
                    throw new Error(REFERRAL_CONFLICT);
                }
                return true;
            });
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message === REFERRAL_CONFLICT) {
                return false;
            }
            this.logger.error('Failed to apply waitlist referral', {
                operation: 'WaitlistRepository.applyReferral',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to apply waitlist referral', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async countReferrals(referrerId) {
        try {
            const [row] = await this.db
                .select({
                total: (0, drizzle_orm_1.sql) `count(*)`,
            })
                .from(waitlist_schema_1.waitlistReferralEvents)
                .where((0, drizzle_orm_1.eq)(waitlist_schema_1.waitlistReferralEvents.referrerId, referrerId));
            return Number(row?.total ?? 0);
        }
        catch (error) {
            this.logger.error('Failed to count waitlist referrals', {
                operation: 'WaitlistRepository.countReferrals',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to count referrals', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
    async createReward(params) {
        try {
            const [row] = await this.db
                .insert(waitlist_schema_1.waitlistReferralRewards)
                .values({
                waitlistEntryId: params.waitlistEntryId,
                type: params.type,
                status: params.status,
                grantedAt: params.grantedAt ?? null,
                meta: params.meta ?? null,
            })
                .onConflictDoNothing({
                target: [waitlist_schema_1.waitlistReferralRewards.waitlistEntryId, waitlist_schema_1.waitlistReferralRewards.type],
            })
                .returning();
            if (!row) {
                return null;
            }
            return (0, waitlist_mappers_1.toWaitlistReferralReward)(row);
        }
        catch (error) {
            this.logger.error('Failed to create waitlist reward', {
                operation: 'WaitlistRepository.createReward',
                error: (0, forma_error_1.formatError)(error),
            });
            throw new base_error_1.BaseAppError('Failed to create waitlist reward', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
    }
}
exports.WaitlistRepository = WaitlistRepository;
