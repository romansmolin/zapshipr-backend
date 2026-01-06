"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagCategory = exports.workspaceTags = exports.inspirationsExtractions = exports.inspirationStatus = exports.inspirationType = exports.rawInspirations = exports.workspaces = exports.waitlistReferralRewards = exports.waitlistReferralEvents = exports.waitlistEntries = exports.users = exports.pinterestBoards = exports.socialAccounts = exports.postMediaAssets = exports.mediaAssets = exports.postTargets = exports.posts = exports.schema = void 0;
const post_schema_1 = require("@/modules/post/entity/post.schema");
const social_account_schema_1 = require("@/modules/social/entity/social-account.schema");
const user_schema_1 = require("@/modules/user/entity/user.schema");
const waitlist_schema_1 = require("@/modules/waitlist/entity/waitlist.schema");
const workspace_schema_1 = require("@/modules/workspace/entity/workspace.schema");
const raw_inspiration_schema_1 = require("@/modules/inspiration/entity/raw-inspiration.schema");
const inspirations_extraction_schema_1 = require("@/modules/inspiration/entity/inspirations-extraction.schema");
const workspace_tag_schema_1 = require("@/modules/inspiration/entity/workspace-tag.schema");
exports.schema = {
    users: user_schema_1.users,
    workspaces: workspace_schema_1.workspaces,
    socialAccounts: social_account_schema_1.socialAccounts,
    pinterestBoards: social_account_schema_1.pinterestBoards,
    posts: post_schema_1.posts,
    postTargets: post_schema_1.postTargets,
    mediaAssets: post_schema_1.mediaAssets,
    postMediaAssets: post_schema_1.postMediaAssets,
    waitlistEntries: waitlist_schema_1.waitlistEntries,
    waitlistReferralEvents: waitlist_schema_1.waitlistReferralEvents,
    waitlistReferralRewards: waitlist_schema_1.waitlistReferralRewards,
    rawInspirations: raw_inspiration_schema_1.rawInspirations,
    inspirationsExtractions: inspirations_extraction_schema_1.inspirationsExtractions,
    workspaceTags: workspace_tag_schema_1.workspaceTags,
};
var post_schema_2 = require("@/modules/post/entity/post.schema");
Object.defineProperty(exports, "posts", { enumerable: true, get: function () { return post_schema_2.posts; } });
Object.defineProperty(exports, "postTargets", { enumerable: true, get: function () { return post_schema_2.postTargets; } });
Object.defineProperty(exports, "mediaAssets", { enumerable: true, get: function () { return post_schema_2.mediaAssets; } });
Object.defineProperty(exports, "postMediaAssets", { enumerable: true, get: function () { return post_schema_2.postMediaAssets; } });
var social_account_schema_2 = require("../modules/social/entity/social-account.schema");
Object.defineProperty(exports, "socialAccounts", { enumerable: true, get: function () { return social_account_schema_2.socialAccounts; } });
Object.defineProperty(exports, "pinterestBoards", { enumerable: true, get: function () { return social_account_schema_2.pinterestBoards; } });
var user_schema_2 = require("@/modules/user/entity/user.schema");
Object.defineProperty(exports, "users", { enumerable: true, get: function () { return user_schema_2.users; } });
var waitlist_schema_2 = require("@/modules/waitlist/entity/waitlist.schema");
Object.defineProperty(exports, "waitlistEntries", { enumerable: true, get: function () { return waitlist_schema_2.waitlistEntries; } });
Object.defineProperty(exports, "waitlistReferralEvents", { enumerable: true, get: function () { return waitlist_schema_2.waitlistReferralEvents; } });
Object.defineProperty(exports, "waitlistReferralRewards", { enumerable: true, get: function () { return waitlist_schema_2.waitlistReferralRewards; } });
var workspace_schema_2 = require("@/modules/workspace/entity/workspace.schema");
Object.defineProperty(exports, "workspaces", { enumerable: true, get: function () { return workspace_schema_2.workspaces; } });
var raw_inspiration_schema_2 = require("@/modules/inspiration/entity/raw-inspiration.schema");
Object.defineProperty(exports, "rawInspirations", { enumerable: true, get: function () { return raw_inspiration_schema_2.rawInspirations; } });
Object.defineProperty(exports, "inspirationType", { enumerable: true, get: function () { return raw_inspiration_schema_2.inspirationType; } });
Object.defineProperty(exports, "inspirationStatus", { enumerable: true, get: function () { return raw_inspiration_schema_2.inspirationStatus; } });
var inspirations_extraction_schema_2 = require("@/modules/inspiration/entity/inspirations-extraction.schema");
Object.defineProperty(exports, "inspirationsExtractions", { enumerable: true, get: function () { return inspirations_extraction_schema_2.inspirationsExtractions; } });
var workspace_tag_schema_2 = require("@/modules/inspiration/entity/workspace-tag.schema");
Object.defineProperty(exports, "workspaceTags", { enumerable: true, get: function () { return workspace_tag_schema_2.workspaceTags; } });
Object.defineProperty(exports, "tagCategory", { enumerable: true, get: function () { return workspace_tag_schema_2.tagCategory; } });
