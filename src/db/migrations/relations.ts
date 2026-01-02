import { relations } from "drizzle-orm/relations";
import { tenants, socialAccounts, userPlans, passwordResetTokens, mediaAssets, posts, magicLinks, waitlistEntries, waitlistReferralRewards, pinterestBoards, waitlistReferralEvents, tiktokPublishJobs, userPlanUsage, tenantSettings, postMediaAssets, postTargets } from "./schema";

export const socialAccountsRelations = relations(socialAccounts, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [socialAccounts.tenantId],
		references: [tenants.id]
	}),
	pinterestBoards: many(pinterestBoards),
	tiktokPublishJobs: many(tiktokPublishJobs),
	postTargets: many(postTargets),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	socialAccounts: many(socialAccounts),
	userPlans: many(userPlans),
	passwordResetTokens: many(passwordResetTokens),
	mediaAssets: many(mediaAssets),
	posts: many(posts),
	magicLinks: many(magicLinks),
	pinterestBoards: many(pinterestBoards),
	tiktokPublishJobs: many(tiktokPublishJobs),
	userPlanUsages: many(userPlanUsage),
	tenantSettings: many(tenantSettings),
}));

export const userPlansRelations = relations(userPlans, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [userPlans.tenantId],
		references: [tenants.id]
	}),
	userPlanUsages: many(userPlanUsage),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	tenant: one(tenants, {
		fields: [passwordResetTokens.tenantId],
		references: [tenants.id]
	}),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [mediaAssets.tenantId],
		references: [tenants.id]
	}),
	postMediaAssets: many(postMediaAssets),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [posts.tenantId],
		references: [tenants.id]
	}),
	postMediaAssets: many(postMediaAssets),
}));

export const magicLinksRelations = relations(magicLinks, ({one}) => ({
	tenant: one(tenants, {
		fields: [magicLinks.redeemedByUserId],
		references: [tenants.id]
	}),
}));

export const waitlistEntriesRelations = relations(waitlistEntries, ({one, many}) => ({
	waitlistEntry: one(waitlistEntries, {
		fields: [waitlistEntries.referredById],
		references: [waitlistEntries.id],
		relationName: "waitlistEntries_referredById_waitlistEntries_id"
	}),
	waitlistEntries: many(waitlistEntries, {
		relationName: "waitlistEntries_referredById_waitlistEntries_id"
	}),
	waitlistReferralRewards: many(waitlistReferralRewards),
	waitlistReferralEvents_referrerId: many(waitlistReferralEvents, {
		relationName: "waitlistReferralEvents_referrerId_waitlistEntries_id"
	}),
	waitlistReferralEvents_referredEntryId: many(waitlistReferralEvents, {
		relationName: "waitlistReferralEvents_referredEntryId_waitlistEntries_id"
	}),
}));

export const waitlistReferralRewardsRelations = relations(waitlistReferralRewards, ({one}) => ({
	waitlistEntry: one(waitlistEntries, {
		fields: [waitlistReferralRewards.waitlistEntryId],
		references: [waitlistEntries.id]
	}),
}));

export const pinterestBoardsRelations = relations(pinterestBoards, ({one}) => ({
	tenant: one(tenants, {
		fields: [pinterestBoards.tenantId],
		references: [tenants.id]
	}),
	socialAccount: one(socialAccounts, {
		fields: [pinterestBoards.socialAccountId],
		references: [socialAccounts.id]
	}),
}));

export const waitlistReferralEventsRelations = relations(waitlistReferralEvents, ({one}) => ({
	waitlistEntry_referrerId: one(waitlistEntries, {
		fields: [waitlistReferralEvents.referrerId],
		references: [waitlistEntries.id],
		relationName: "waitlistReferralEvents_referrerId_waitlistEntries_id"
	}),
	waitlistEntry_referredEntryId: one(waitlistEntries, {
		fields: [waitlistReferralEvents.referredEntryId],
		references: [waitlistEntries.id],
		relationName: "waitlistReferralEvents_referredEntryId_waitlistEntries_id"
	}),
}));

export const tiktokPublishJobsRelations = relations(tiktokPublishJobs, ({one}) => ({
	tenant: one(tenants, {
		fields: [tiktokPublishJobs.tenantId],
		references: [tenants.id]
	}),
	socialAccount: one(socialAccounts, {
		fields: [tiktokPublishJobs.socialAccountId],
		references: [socialAccounts.id]
	}),
}));

export const userPlanUsageRelations = relations(userPlanUsage, ({one}) => ({
	tenant: one(tenants, {
		fields: [userPlanUsage.tenantId],
		references: [tenants.id]
	}),
	userPlan: one(userPlans, {
		fields: [userPlanUsage.planId],
		references: [userPlans.id]
	}),
}));

export const tenantSettingsRelations = relations(tenantSettings, ({one}) => ({
	tenant: one(tenants, {
		fields: [tenantSettings.tenantId],
		references: [tenants.id]
	}),
}));

export const postMediaAssetsRelations = relations(postMediaAssets, ({one}) => ({
	post: one(posts, {
		fields: [postMediaAssets.postId],
		references: [posts.id]
	}),
	mediaAsset: one(mediaAssets, {
		fields: [postMediaAssets.mediaAssetId],
		references: [mediaAssets.id]
	}),
}));

export const postTargetsRelations = relations(postTargets, ({one}) => ({
	socialAccount: one(socialAccounts, {
		fields: [postTargets.socialAccountId],
		references: [socialAccounts.id]
	}),
}));