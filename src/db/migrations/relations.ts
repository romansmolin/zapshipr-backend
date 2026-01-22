import { relations } from "drizzle-orm/relations";
import { users, socialAccounts, userPlans, passwordResetTokens, mediaAssets, magicLinks, waitlistEntries, posts, pinterestBoards, tiktokPublishJobs, userPlanUsage, tenantSettings, rawInspirations, transcripts, workspaces, workspaceTags, inspirationsExtractions, postMediaAssets, postTargets } from "./schema";

export const socialAccountsRelations = relations(socialAccounts, ({one, many}) => ({
	user_userId: one(users, {
		fields: [socialAccounts.userId],
		references: [users.id],
		relationName: "socialAccounts_userId_users_id"
	}),
	pinterestBoards_socialAccountId: many(pinterestBoards, {
		relationName: "pinterestBoards_socialAccountId_socialAccounts_id"
	}),
	tiktokPublishJobs: many(tiktokPublishJobs),
	postTargets_socialAccountId: many(postTargets, {
		relationName: "postTargets_socialAccountId_socialAccounts_id"
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	socialAccounts_userId: many(socialAccounts, {
		relationName: "socialAccounts_userId_users_id"
	}),
	userPlans: many(userPlans),
	passwordResetTokens: many(passwordResetTokens),
	mediaAssets_userId: many(mediaAssets, {
		relationName: "mediaAssets_userId_users_id"
	}),
	magicLinks: many(magicLinks),
	posts_userId: many(posts, {
		relationName: "posts_userId_users_id"
	}),
	pinterestBoards_userId: many(pinterestBoards, {
		relationName: "pinterestBoards_userId_users_id"
	}),
	tiktokPublishJobs: many(tiktokPublishJobs),
	userPlanUsages: many(userPlanUsage),
	tenantSettings: many(tenantSettings),
	workspaces: many(workspaces),
	rawInspirations: many(rawInspirations),
}));

export const userPlansRelations = relations(userPlans, ({one, many}) => ({
	user: one(users, {
		fields: [userPlans.userId],
		references: [users.id]
	}),
	userPlanUsages: many(userPlanUsage),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({one, many}) => ({
	user_userId: one(users, {
		fields: [mediaAssets.userId],
		references: [users.id],
		relationName: "mediaAssets_userId_users_id"
	}),
	postMediaAssets_mediaAssetId: many(postMediaAssets, {
		relationName: "postMediaAssets_mediaAssetId_mediaAssets_id"
	}),
}));

export const magicLinksRelations = relations(magicLinks, ({one}) => ({
	user: one(users, {
		fields: [magicLinks.redeemedByUserId],
		references: [users.id]
	}),
}));

export const waitlistEntriesRelations = relations(waitlistEntries, ({one, many}) => ({
	waitlistEntry_referredById: one(waitlistEntries, {
		fields: [waitlistEntries.referredById],
		references: [waitlistEntries.id],
		relationName: "waitlistEntries_referredById_waitlistEntries_id"
	}),
	waitlistEntries_referredById: many(waitlistEntries, {
		relationName: "waitlistEntries_referredById_waitlistEntries_id"
	}),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	user_userId: one(users, {
		fields: [posts.userId],
		references: [users.id],
		relationName: "posts_userId_users_id"
	}),
	postMediaAssets_postId: many(postMediaAssets, {
		relationName: "postMediaAssets_postId_posts_id"
	}),
	postTargets: many(postTargets),
}));

export const pinterestBoardsRelations = relations(pinterestBoards, ({one}) => ({
	socialAccount_socialAccountId: one(socialAccounts, {
		fields: [pinterestBoards.socialAccountId],
		references: [socialAccounts.id],
		relationName: "pinterestBoards_socialAccountId_socialAccounts_id"
	}),
	user_userId: one(users, {
		fields: [pinterestBoards.userId],
		references: [users.id],
		relationName: "pinterestBoards_userId_users_id"
	}),
}));

export const tiktokPublishJobsRelations = relations(tiktokPublishJobs, ({one}) => ({
	socialAccount: one(socialAccounts, {
		fields: [tiktokPublishJobs.socialAccountId],
		references: [socialAccounts.id]
	}),
	user: one(users, {
		fields: [tiktokPublishJobs.userId],
		references: [users.id]
	}),
}));

export const userPlanUsageRelations = relations(userPlanUsage, ({one}) => ({
	userPlan: one(userPlans, {
		fields: [userPlanUsage.planId],
		references: [userPlans.id]
	}),
	user: one(users, {
		fields: [userPlanUsage.userId],
		references: [users.id]
	}),
}));

export const tenantSettingsRelations = relations(tenantSettings, ({one}) => ({
	user: one(users, {
		fields: [tenantSettings.userId],
		references: [users.id]
	}),
}));

export const transcriptsRelations = relations(transcripts, ({one}) => ({
	rawInspiration: one(rawInspirations, {
		fields: [transcripts.inspirationId],
		references: [rawInspirations.id]
	}),
}));

export const rawInspirationsRelations = relations(rawInspirations, ({one, many}) => ({
	transcripts: many(transcripts),
	user: one(users, {
		fields: [rawInspirations.userId],
		references: [users.id]
	}),
	workspace: one(workspaces, {
		fields: [rawInspirations.workspaceId],
		references: [workspaces.id]
	}),
	inspirationsExtractions: many(inspirationsExtractions),
}));

export const workspaceTagsRelations = relations(workspaceTags, ({one}) => ({
	workspace: one(workspaces, {
		fields: [workspaceTags.workspaceId],
		references: [workspaces.id]
	}),
}));

export const workspacesRelations = relations(workspaces, ({one, many}) => ({
	workspaceTags: many(workspaceTags),
	user: one(users, {
		fields: [workspaces.userId],
		references: [users.id]
	}),
	rawInspirations: many(rawInspirations),
	inspirationsExtractions: many(inspirationsExtractions),
}));

export const inspirationsExtractionsRelations = relations(inspirationsExtractions, ({one}) => ({
	rawInspiration: one(rawInspirations, {
		fields: [inspirationsExtractions.rawInspirationId],
		references: [rawInspirations.id]
	}),
	workspace: one(workspaces, {
		fields: [inspirationsExtractions.workspaceId],
		references: [workspaces.id]
	}),
}));

export const postMediaAssetsRelations = relations(postMediaAssets, ({one}) => ({
	post_postId: one(posts, {
		fields: [postMediaAssets.postId],
		references: [posts.id],
		relationName: "postMediaAssets_postId_posts_id"
	}),
	mediaAsset_mediaAssetId: one(mediaAssets, {
		fields: [postMediaAssets.mediaAssetId],
		references: [mediaAssets.id],
		relationName: "postMediaAssets_mediaAssetId_mediaAssets_id"
	}),
}));

export const postTargetsRelations = relations(postTargets, ({one}) => ({
	socialAccount_socialAccountId: one(socialAccounts, {
		fields: [postTargets.socialAccountId],
		references: [socialAccounts.id],
		relationName: "postTargets_socialAccountId_socialAccounts_id"
	}),
	post: one(posts, {
		fields: [postTargets.postId],
		references: [posts.id]
	}),
}));
