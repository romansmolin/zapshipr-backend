"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokPostMode = exports.TikTokMediaAssestSourceType = exports.TikTokPrivacyLevel = exports.InstagramPostStatus = exports.InstagramMediaType = exports.ThreadsPostStatus = exports.ThreadsMediaType = exports.PostStatus = void 0;
var PostStatus;
(function (PostStatus) {
    PostStatus["DRAFT"] = "DRAFT";
    PostStatus["PENDING"] = "PENDING";
    PostStatus["POSTING"] = "POSTING";
    PostStatus["DONE"] = "DONE";
    PostStatus["FAILED"] = "FAILED";
    PostStatus["PARTIALLY_DONE"] = "PARTIALLY_DONE";
})(PostStatus || (exports.PostStatus = PostStatus = {}));
var ThreadsMediaType;
(function (ThreadsMediaType) {
    ThreadsMediaType["TEXT"] = "TEXT";
    ThreadsMediaType["IMAGE"] = "IMAGE";
    ThreadsMediaType["VIDEO"] = "VIDEO";
    ThreadsMediaType["CAROUSEL"] = "CAROUSEL";
})(ThreadsMediaType || (exports.ThreadsMediaType = ThreadsMediaType = {}));
var ThreadsPostStatus;
(function (ThreadsPostStatus) {
    ThreadsPostStatus["FINISHED"] = "FINISHED";
    ThreadsPostStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ThreadsPostStatus["PUBLISHED"] = "PUBLISHED";
    ThreadsPostStatus["ERROR"] = "ERROR";
    ThreadsPostStatus["EXPIRED"] = "EXPIRED";
})(ThreadsPostStatus || (exports.ThreadsPostStatus = ThreadsPostStatus = {}));
var InstagramMediaType;
(function (InstagramMediaType) {
    InstagramMediaType["IMAGE"] = "IMAGE";
    InstagramMediaType["VIDEO"] = "VIDEO";
    InstagramMediaType["REELS"] = "REELS";
    InstagramMediaType["STORIES"] = "STORIES";
})(InstagramMediaType || (exports.InstagramMediaType = InstagramMediaType = {}));
var InstagramPostStatus;
(function (InstagramPostStatus) {
    InstagramPostStatus["FINISHED"] = "FINISHED";
    InstagramPostStatus["IN_PROGRESS"] = "IN_PROGRESS";
    InstagramPostStatus["PUBLISHED"] = "PUBLISHED";
    InstagramPostStatus["ERROR"] = "ERROR";
    InstagramPostStatus["EXPIRED"] = "EXPIRED";
})(InstagramPostStatus || (exports.InstagramPostStatus = InstagramPostStatus = {}));
var TikTokPrivacyLevel;
(function (TikTokPrivacyLevel) {
    TikTokPrivacyLevel["PUBLIC"] = "PUBLIC";
    TikTokPrivacyLevel["FRIENDS"] = "FRIENDS";
    TikTokPrivacyLevel["PRIVATE"] = "PRIVATE";
    TikTokPrivacyLevel["SELF_ONLY"] = "SELF_ONLY";
})(TikTokPrivacyLevel || (exports.TikTokPrivacyLevel = TikTokPrivacyLevel = {}));
var TikTokMediaAssestSourceType;
(function (TikTokMediaAssestSourceType) {
    TikTokMediaAssestSourceType["FILE_UPLOAD"] = "FILE_UPLOAD";
    TikTokMediaAssestSourceType["PULL_FROM_URL"] = "PULL_FROM_URL";
})(TikTokMediaAssestSourceType || (exports.TikTokMediaAssestSourceType = TikTokMediaAssestSourceType = {}));
var TikTokPostMode;
(function (TikTokPostMode) {
    TikTokPostMode["DIRECT_POST"] = "DIRECT_POST";
})(TikTokPostMode || (exports.TikTokPostMode = TikTokPostMode = {}));
