"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTargetsRelations = exports.postMediaAssetsRelations = exports.tenantSettingsRelations = exports.userPlanUsageRelations = exports.tiktokPublishJobsRelations = exports.waitlistReferralEventsRelations = exports.pinterestBoardsRelations = exports.waitlistReferralRewardsRelations = exports.waitlistEntriesRelations = exports.magicLinksRelations = exports.postsRelations = exports.mediaAssetsRelations = exports.passwordResetTokensRelations = exports.userPlansRelations = exports.tenantsRelations = exports.socialAccountsRelations = void 0;
const relations_1 = require("drizzle-orm/relations");
const schema_1 = require("./schema");
exports.socialAccountsRelations = (0, relations_1.relations)(schema_1.socialAccounts, ({ one, many }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.socialAccounts.tenantId],
        references: [schema_1.tenants.id]
    }),
    pinterestBoards: many(schema_1.pinterestBoards),
    tiktokPublishJobs: many(schema_1.tiktokPublishJobs),
    postTargets: many(schema_1.postTargets),
}));
exports.tenantsRelations = (0, relations_1.relations)(schema_1.tenants, ({ many }) => ({
    socialAccounts: many(schema_1.socialAccounts),
    userPlans: many(schema_1.userPlans),
    passwordResetTokens: many(schema_1.passwordResetTokens),
    mediaAssets: many(schema_1.mediaAssets),
    posts: many(schema_1.posts),
    magicLinks: many(schema_1.magicLinks),
    pinterestBoards: many(schema_1.pinterestBoards),
    tiktokPublishJobs: many(schema_1.tiktokPublishJobs),
    userPlanUsages: many(schema_1.userPlanUsage),
    tenantSettings: many(schema_1.tenantSettings),
}));
exports.userPlansRelations = (0, relations_1.relations)(schema_1.userPlans, ({ one, many }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.userPlans.tenantId],
        references: [schema_1.tenants.id]
    }),
    userPlanUsages: many(schema_1.userPlanUsage),
}));
exports.passwordResetTokensRelations = (0, relations_1.relations)(schema_1.passwordResetTokens, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.passwordResetTokens.tenantId],
        references: [schema_1.tenants.id]
    }),
}));
exports.mediaAssetsRelations = (0, relations_1.relations)(schema_1.mediaAssets, ({ one, many }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.mediaAssets.tenantId],
        references: [schema_1.tenants.id]
    }),
    postMediaAssets: many(schema_1.postMediaAssets),
}));
exports.postsRelations = (0, relations_1.relations)(schema_1.posts, ({ one, many }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.posts.tenantId],
        references: [schema_1.tenants.id]
    }),
    postMediaAssets: many(schema_1.postMediaAssets),
}));
exports.magicLinksRelations = (0, relations_1.relations)(schema_1.magicLinks, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.magicLinks.redeemedByUserId],
        references: [schema_1.tenants.id]
    }),
}));
exports.waitlistEntriesRelations = (0, relations_1.relations)(schema_1.waitlistEntries, ({ one, many }) => ({
    waitlistEntry: one(schema_1.waitlistEntries, {
        fields: [schema_1.waitlistEntries.referredById],
        references: [schema_1.waitlistEntries.id],
        relationName: "waitlistEntries_referredById_waitlistEntries_id"
    }),
    waitlistEntries: many(schema_1.waitlistEntries, {
        relationName: "waitlistEntries_referredById_waitlistEntries_id"
    }),
    waitlistReferralRewards: many(schema_1.waitlistReferralRewards),
    waitlistReferralEvents_referrerId: many(schema_1.waitlistReferralEvents, {
        relationName: "waitlistReferralEvents_referrerId_waitlistEntries_id"
    }),
    waitlistReferralEvents_referredEntryId: many(schema_1.waitlistReferralEvents, {
        relationName: "waitlistReferralEvents_referredEntryId_waitlistEntries_id"
    }),
}));
exports.waitlistReferralRewardsRelations = (0, relations_1.relations)(schema_1.waitlistReferralRewards, ({ one }) => ({
    waitlistEntry: one(schema_1.waitlistEntries, {
        fields: [schema_1.waitlistReferralRewards.waitlistEntryId],
        references: [schema_1.waitlistEntries.id]
    }),
}));
exports.pinterestBoardsRelations = (0, relations_1.relations)(schema_1.pinterestBoards, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.pinterestBoards.tenantId],
        references: [schema_1.tenants.id]
    }),
    socialAccount: one(schema_1.socialAccounts, {
        fields: [schema_1.pinterestBoards.socialAccountId],
        references: [schema_1.socialAccounts.id]
    }),
}));
exports.waitlistReferralEventsRelations = (0, relations_1.relations)(schema_1.waitlistReferralEvents, ({ one }) => ({
    waitlistEntry_referrerId: one(schema_1.waitlistEntries, {
        fields: [schema_1.waitlistReferralEvents.referrerId],
        references: [schema_1.waitlistEntries.id],
        relationName: "waitlistReferralEvents_referrerId_waitlistEntries_id"
    }),
    waitlistEntry_referredEntryId: one(schema_1.waitlistEntries, {
        fields: [schema_1.waitlistReferralEvents.referredEntryId],
        references: [schema_1.waitlistEntries.id],
        relationName: "waitlistReferralEvents_referredEntryId_waitlistEntries_id"
    }),
}));
exports.tiktokPublishJobsRelations = (0, relations_1.relations)(schema_1.tiktokPublishJobs, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.tiktokPublishJobs.tenantId],
        references: [schema_1.tenants.id]
    }),
    socialAccount: one(schema_1.socialAccounts, {
        fields: [schema_1.tiktokPublishJobs.socialAccountId],
        references: [schema_1.socialAccounts.id]
    }),
}));
exports.userPlanUsageRelations = (0, relations_1.relations)(schema_1.userPlanUsage, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.userPlanUsage.tenantId],
        references: [schema_1.tenants.id]
    }),
    userPlan: one(schema_1.userPlans, {
        fields: [schema_1.userPlanUsage.planId],
        references: [schema_1.userPlans.id]
    }),
}));
exports.tenantSettingsRelations = (0, relations_1.relations)(schema_1.tenantSettings, ({ one }) => ({
    tenant: one(schema_1.tenants, {
        fields: [schema_1.tenantSettings.tenantId],
        references: [schema_1.tenants.id]
    }),
}));
exports.postMediaAssetsRelations = (0, relations_1.relations)(schema_1.postMediaAssets, ({ one }) => ({
    post: one(schema_1.posts, {
        fields: [schema_1.postMediaAssets.postId],
        references: [schema_1.posts.id]
    }),
    mediaAsset: one(schema_1.mediaAssets, {
        fields: [schema_1.postMediaAssets.mediaAssetId],
        references: [schema_1.mediaAssets.id]
    }),
}));
exports.postTargetsRelations = (0, relations_1.relations)(schema_1.postTargets, ({ one }) => ({
    socialAccount: one(schema_1.socialAccounts, {
        fields: [schema_1.postTargets.socialAccountId],
        references: [schema_1.socialAccounts.id]
    }),
}));
