"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostPlatformsWithoutX = exports.PostPlatforms = exports.SocilaMediaPlatform = void 0;
var SocilaMediaPlatform;
(function (SocilaMediaPlatform) {
    SocilaMediaPlatform["FACEBOOK"] = "facebook";
    SocilaMediaPlatform["INSTAGRAM"] = "instagram";
    SocilaMediaPlatform["THREADS"] = "threads";
    SocilaMediaPlatform["PINTEREST"] = "pinterest";
    SocilaMediaPlatform["TIKTOK"] = "tiktok";
    SocilaMediaPlatform["YOUTUBE"] = "youtube";
    SocilaMediaPlatform["X"] = "x";
    SocilaMediaPlatform["LINKEDIN"] = "linkedin";
    SocilaMediaPlatform["BLUESKY"] = "bluesky";
})(SocilaMediaPlatform || (exports.SocilaMediaPlatform = SocilaMediaPlatform = {}));
exports.PostPlatforms = Object.values(SocilaMediaPlatform);
exports.PostPlatformsWithoutX = exports.PostPlatforms.filter((platform) => platform !== SocilaMediaPlatform.X);
