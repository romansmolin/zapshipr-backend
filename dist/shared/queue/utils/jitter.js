"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryUtils = exports.JitterUtils = void 0;
// utils/jitter-utils.ts
const crypto_1 = require("crypto");
const platform_config_1 = require("../config/platform-config");
class JitterUtils {
    /**
     * Apply jitter to a scheduled time to spread load
     */
    static applyJitter(platform, originalTime, postId, userId) {
        const config = platform_config_1.PlatformConfigManager.getConfig(platform);
        const jitterWindowMs = config.jitterWindowSec * 1000;
        if (config.retryConfig.deterministicJitter) {
            return this.deterministicJitter(originalTime, jitterWindowMs, postId, userId);
        }
        else {
            return this.randomJitter(originalTime, jitterWindowMs);
        }
    }
    /**
     * Deterministic jitter based on hash of postId + userId
     */
    static deterministicJitter(originalTime, jitterWindowMs, postId, userId) {
        const hash = (0, crypto_1.createHash)('sha256').update(`${postId}-${userId}`).digest('hex');
        // Use first 8 characters of hash to get a number between 0 and 1
        const hashValue = parseInt(hash.substring(0, 8), 16);
        const normalizedHash = hashValue / 0xffffffff;
        // Apply jitter: -jitterWindow/2 to +jitterWindow/2
        const jitterMs = (normalizedHash - 0.5) * jitterWindowMs;
        return new Date(originalTime.getTime() + jitterMs);
    }
    /**
     * Random jitter
     */
    static randomJitter(originalTime, jitterWindowMs) {
        const jitterMs = (Math.random() - 0.5) * jitterWindowMs;
        return new Date(originalTime.getTime() + jitterMs);
    }
    /**
     * Calculate retry delay with exponential backoff and jitter
     */
    static calculateRetryDelay(platform, attemptNumber, postId, userId) {
        const config = platform_config_1.PlatformConfigManager.getConfig(platform);
        const { baseDelaySec, jitterPercent, deterministicJitter } = config.retryConfig;
        // Exponential backoff: baseDelay * 2^attempt
        const baseDelayMs = baseDelaySec * 1000 * Math.pow(2, attemptNumber - 1);
        // Apply jitter to prevent thundering herd
        const jitterRange = baseDelayMs * jitterPercent;
        let jitter;
        if (deterministicJitter) {
            const hash = (0, crypto_1.createHash)('sha256').update(`${postId}-${userId}-${attemptNumber}`).digest('hex');
            const hashValue = parseInt(hash.substring(0, 8), 16);
            const normalizedHash = hashValue / 0xffffffff;
            jitter = (normalizedHash - 0.5) * 2 * jitterRange;
        }
        else {
            jitter = (Math.random() - 0.5) * 2 * jitterRange;
        }
        return Math.max(1000, baseDelayMs + jitter); // Minimum 1 second delay
    }
    /**
     * Check if we should apply warmup delay
     */
    static shouldApplyWarmup(scheduledTime) {
        const now = Date.now();
        const scheduledTimeMs = scheduledTime.getTime();
        const warmupTimeMs = platform_config_1.PlatformConfigManager.getWarmupTime();
        return scheduledTimeMs - now < warmupTimeMs;
    }
    /**
     * Calculate warmup delay to ensure minimum warmup time
     */
    static calculateWarmupDelay(scheduledTime) {
        const now = Date.now();
        const scheduledTimeMs = scheduledTime.getTime();
        const warmupTimeMs = platform_config_1.PlatformConfigManager.getWarmupTime();
        const currentDelay = scheduledTimeMs - now;
        // Skip warmup delay for posts scheduled within 5 minutes (300 seconds)
        // This prevents the 5-minute warmup delay for most user-scheduled posts
        if (currentDelay <= 300000) {
            return 0;
        }
        if (currentDelay < warmupTimeMs) {
            return Math.max(0, warmupTimeMs - currentDelay);
        }
        return 0;
    }
}
exports.JitterUtils = JitterUtils;
class RetryUtils {
    /**
     * Determine if an error is retryable
     */
    static isRetryableError(error) {
        if (!error)
            return false;
        // Network errors are typically retryable
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return true;
        }
        // HTTP status codes that are retryable
        if (error.response?.status) {
            const status = error.response.status;
            // 429 (Too Many Requests), 502, 503, 504 are retryable
            return [429, 502, 503, 504].includes(status);
        }
        // Platform-specific retryable errors
        if (error.message) {
            const message = error.message.toLowerCase();
            return (message.includes('rate limit') ||
                message.includes('timeout') ||
                message.includes('server error') ||
                message.includes('service unavailable') ||
                message.includes('temporary'));
        }
        return false;
    }
    /**
     * Extract retry-after delay from error response
     */
    static extractRetryAfter(error) {
        // Check Retry-After header (in seconds)
        if (error.response?.headers?.['retry-after']) {
            const retryAfter = parseInt(error.response.headers['retry-after']);
            return isNaN(retryAfter) ? undefined : retryAfter * 1000; // Convert to ms
        }
        // Check rate limit reset headers
        if (error.response?.headers?.['x-rate-limit-reset']) {
            const resetTime = parseInt(error.response.headers['x-rate-limit-reset']);
            if (!isNaN(resetTime)) {
                return Math.max(0, resetTime * 1000 - Date.now());
            }
        }
        // Platform-specific error parsing
        if (error.response?.data) {
            const data = error.response.data;
            // TikTok specific
            if (data.error?.code === 'rate_limit_exceeded' && data.error?.retry_after) {
                return data.error.retry_after * 1000;
            }
            // Generic API error with retry_after
            if (data.retry_after) {
                return data.retry_after * 1000;
            }
        }
        return undefined;
    }
    /**
     * Create a retryable error wrapper
     */
    static createRetryableError(originalError, isRetryable, retryAfter) {
        const retryableError = originalError;
        retryableError.isRetryable = isRetryable;
        retryableError.retryAfter = retryAfter;
        return retryableError;
    }
}
exports.RetryUtils = RetryUtils;
