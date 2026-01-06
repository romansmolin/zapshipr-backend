"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMqPostScheduler = void 0;
// enhanced-bullmq-post-scheduler.ts
const bullmq_1 = require("bullmq");
const uuid_1 = require("uuid");
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
const platform_config_1 = require("../../config/platform-config");
const jitter_1 = require("../../utils/jitter");
const rate_limiter_1 = require("../../utils/rate-limiter");
const youtube_quota_manager_1 = require("../../utils/youtube-quota-manager");
const redis_1 = require("../redis");
class BullMqPostScheduler {
    constructor() {
        this.limitsEnabled = (process.env.SCHEDULER_LIMITS_ENABLED ?? 'false').toLowerCase() === 'true';
        this.rateLimiter = new rate_limiter_1.PlatformRateLimiter(redis_1.redis);
        this.youtubeQuotaManager = new youtube_quota_manager_1.YouTubeQuotaManager(redis_1.redis);
        this.queues = posts_schemas_1.PostPlatformsWithoutX.reduce((acc, platform) => {
            const config = platform_config_1.PlatformConfigManager.getConfig(platform);
            acc[platform] = new bullmq_1.Queue(`${platform}-scheduler`, {
                connection: redis_1.redisConnection,
                defaultJobOptions: {
                    removeOnComplete: 50, // Keep last 50 completed jobs
                    removeOnFail: 100, // Keep last 100 failed jobs
                    attempts: config.retryConfig.maxRetries + 1, // +1 for initial attempt
                    backoff: {
                        type: 'custom',
                    },
                },
            });
            return acc;
        }, {});
    }
    getQueue(platform) {
        if (!this.queues[platform]) {
            throw new Error(`No queue for platform: ${platform}`);
        }
        return this.queues[platform];
    }
    async schedulePost(platform, postId, userId, scheduledDate, socialAccountId) {
        try {
            // Generate unique job ID for idempotency
            const jobId = (0, uuid_1.v4)();
            // Check if job already exists (idempotency check)
            const existingJob = await this.findExistingJob(platform, postId, userId, socialAccountId);
            if (existingJob) {
                console.log(`[SCHEDULER] Job already exists for ${platform}:${postId}:${userId}:${socialAccountId}, skipping`);
                return;
            }
            // Check rate limits before scheduling
            const rateLimitResult = this.limitsEnabled
                ? await this.rateLimiter.checkRateLimit(platform, userId, postId)
                : {
                    allowed: true,
                    remainingQuota: Number.POSITIVE_INFINITY,
                    resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                };
            if (!rateLimitResult.allowed && rateLimitResult.retryAfter) {
                // If rate limited, schedule for after the rate limit resets
                const rateLimitedDate = new Date(Date.now() + rateLimitResult.retryAfter * 1000);
                if (rateLimitedDate > scheduledDate) {
                    console.warn(`[SCHEDULER] Rate limit exceeded for ${platform}:${userId}. Rescheduling from ${scheduledDate.toISOString()} to ${rateLimitedDate.toISOString()}`);
                    scheduledDate = rateLimitedDate;
                }
            }
            // Special handling for YouTube quota reservation
            let quotaReservation = null;
            if (this.limitsEnabled && platform === 'youtube') {
                const quotaResult = await this.youtubeQuotaManager.reserveQuota(platform, userId);
                if (!quotaResult.success) {
                    const retryAfter = quotaResult.retryAfter || 3600; // 1 hour default
                    const quotaLimitedDate = new Date(Date.now() + retryAfter * 1000);
                    if (quotaLimitedDate > scheduledDate) {
                        console.warn(`[SCHEDULER] YouTube quota exceeded for ${userId}. Rescheduling from ${scheduledDate.toISOString()} to ${quotaLimitedDate.toISOString()}`);
                        scheduledDate = quotaLimitedDate;
                    }
                }
                else {
                    quotaReservation = quotaResult;
                }
            }
            // Apply jitter to spread load
            const jitteredDate = jitter_1.JitterUtils.applyJitter(platform, scheduledDate, postId, userId);
            // Check if we need warmup time
            const warmupDelay = jitter_1.JitterUtils.calculateWarmupDelay(jitteredDate);
            if (warmupDelay > 0) {
                console.log(`[SCHEDULER] Applying warmup delay of ${warmupDelay}ms for ${platform}:${postId}`);
                jitteredDate.setTime(jitteredDate.getTime() + warmupDelay);
            }
            const delay = Math.max(jitteredDate.getTime() - Date.now(), 0);
            const config = platform_config_1.PlatformConfigManager.getConfig(platform);
            const jobOptions = {
                delay,
                attempts: config.retryConfig.maxRetries + 1,
                backoff: {
                    type: 'custom',
                },
                // Use UUID for idempotency
                jobId,
                // Prevent duplicate jobs
                removeOnComplete: 50,
                removeOnFail: 100,
            };
            const job = await this.getQueue(platform).add('publish-post', {
                jobId,
                postId,
                userId,
                platform,
                socialAccountId,
                originalScheduledDate: scheduledDate.toISOString(),
                jitteredScheduledDate: jitteredDate.toISOString(),
                rateLimitInfo: rateLimitResult,
                quotaReservation,
                status: 'scheduled',
                statusMessage: 'Job scheduled successfully',
                statusUpdatedAt: new Date().toISOString(),
            }, jobOptions);
            console.log(`[SCHEDULER] Scheduled ${platform} job:`, {
                jobId: job.id,
                postId,
                userId,
                socialAccountId,
                originalDate: scheduledDate.toISOString(),
                jitteredDate: jitteredDate.toISOString(),
                delay: `${delay}ms`,
                scheduledFor: new Date(Date.now() + delay).toISOString(),
                queueName: `${platform}-scheduler`,
                remainingQuota: rateLimitResult.remainingQuota,
                rateLimitResetTime: rateLimitResult.resetTime.toISOString(),
                quotaReservation: quotaReservation?.reservedQuota,
            });
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to schedule ${platform} job for ${postId}:`, error);
            throw error;
        }
    }
    async schedulePostWithRateLimitCheck(platform, postId, userId, scheduledDate) {
        try {
            if (!this.limitsEnabled) {
                await this.schedulePost(platform, postId, userId, scheduledDate);
                return {
                    success: true,
                    scheduledDate: jitter_1.JitterUtils.applyJitter(platform, scheduledDate, postId, userId),
                };
            }
            const rateLimitResult = await this.rateLimiter.checkRateLimit(platform, userId, postId);
            if (!rateLimitResult.allowed) {
                return {
                    success: false,
                    error: `Rate limit exceeded. Next available slot: ${rateLimitResult.resetTime.toISOString()}`,
                };
            }
            await this.schedulePost(platform, postId, userId, scheduledDate);
            return {
                success: true,
                scheduledDate: jitter_1.JitterUtils.applyJitter(platform, scheduledDate, postId, userId),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async cancelScheduledPost(platform, postId) {
        try {
            const jobs = await this.getQueue(platform).getDelayed();
            const job = jobs.find((j) => j.data.postId === postId);
            if (job) {
                await job.remove();
                console.log(`[SCHEDULER] Cancelled ${platform} job for post ${postId}`);
            }
            else {
                console.warn(`[SCHEDULER] No delayed job found for ${platform}:${postId}`);
            }
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to cancel ${platform} job for ${postId}:`, error);
            throw error;
        }
    }
    async reschedulePost(platform, postId, userId, newDate) {
        try {
            await this.cancelScheduledPost(platform, postId);
            await this.schedulePost(platform, postId, userId, newDate);
            console.log(`[SCHEDULER] Rescheduled ${platform} post ${postId} to ${newDate.toISOString()}`);
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to reschedule ${platform} post ${postId}:`, error);
            throw error;
        }
    }
    async getQueueStatus(platform) {
        try {
            const queue = this.getQueue(platform);
            const [waiting, delayed, active, completed, failed] = await Promise.all([
                queue.getWaiting(),
                queue.getDelayed(),
                queue.getActive(),
                queue.getCompleted(),
                queue.getFailed(),
            ]);
            return {
                waiting: waiting.length,
                delayed: delayed.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length,
            };
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to get queue status for ${platform}:`, error);
            throw error;
        }
    }
    async getAllQueuesStatus() {
        const statuses = {};
        await Promise.all(posts_schemas_1.PostPlatforms.map(async (platform) => {
            try {
                statuses[platform] = await this.getQueueStatus(platform);
            }
            catch (error) {
                console.error(`[SCHEDULER] Failed to get status for ${platform}:`, error);
                statuses[platform] = {
                    waiting: 0,
                    delayed: 0,
                    active: 0,
                    completed: 0,
                    failed: 0,
                };
            }
        }));
        return statuses;
    }
    async getRateLimitStatus(platform, userId) {
        try {
            if (!this.limitsEnabled) {
                return {
                    allowed: true,
                    remainingQuota: Number.POSITIVE_INFINITY,
                    resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                };
            }
            return await this.rateLimiter.checkRateLimit(platform, userId);
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to get rate limit status for ${platform}:${userId}:`, error);
            throw error;
        }
    }
    async getAllRateLimitStatuses(userId) {
        const statuses = {};
        if (!this.limitsEnabled) {
            posts_schemas_1.PostPlatforms.forEach((platform) => {
                statuses[platform] = {
                    allowed: true,
                    remainingQuota: Number.POSITIVE_INFINITY,
                    resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                };
            });
            return statuses;
        }
        await Promise.all(posts_schemas_1.PostPlatforms.map(async (platform) => {
            try {
                statuses[platform] = await this.rateLimiter.checkRateLimit(platform, userId);
            }
            catch (error) {
                console.error(`[SCHEDULER] Failed to get rate limit status for ${platform}:${userId}:`, error);
                statuses[platform] = {
                    allowed: false,
                    remainingQuota: 0,
                    resetTime: new Date(),
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }));
        return statuses;
    }
    async getUpcomingJobs(platform, limit = 10) {
        try {
            const delayedJobs = await this.getQueue(platform).getDelayed(0, limit - 1);
            return delayedJobs.map((job) => ({
                id: job.id,
                postId: job.data.postId,
                userId: job.data.userId,
                scheduledFor: new Date(Date.now() + job.opts.delay).toISOString(),
                originalScheduledDate: job.data.originalScheduledDate,
                jitteredScheduledDate: job.data.jitteredScheduledDate,
                attempts: job.attemptsMade,
                maxAttempts: job.opts.attempts,
            }));
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to get upcoming jobs for ${platform}:`, error);
            return [];
        }
    }
    async cleanupOldJobs(platform) {
        try {
            const queue = this.getQueue(platform);
            // Clean completed jobs older than 24 hours
            await queue.clean(24 * 60 * 60 * 1000, 100, 'completed');
            // Clean failed jobs older than 7 days
            await queue.clean(7 * 24 * 60 * 60 * 1000, 100, 'failed');
            console.log(`[SCHEDULER] Cleaned up old jobs for ${platform}`);
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to cleanup jobs for ${platform}:`, error);
        }
    }
    async cleanupJobsForDeletedPost(platform, postId) {
        try {
            const queue = this.getQueue(platform);
            // Get all jobs (waiting, delayed, active)
            const [waiting, delayed, active] = await Promise.all([
                queue.getWaiting(),
                queue.getDelayed(),
                queue.getActive(),
            ]);
            const allJobs = [...waiting, ...delayed, ...active];
            const jobsToRemove = allJobs.filter((job) => job.data.postId === postId);
            if (jobsToRemove.length > 0) {
                console.log(`[SCHEDULER] Found ${jobsToRemove.length} jobs to remove for deleted post ${postId} on ${platform}`);
                // Remove all jobs for this post
                await Promise.all(jobsToRemove.map((job) => job.remove()));
                console.log(`[SCHEDULER] Successfully removed ${jobsToRemove.length} jobs for deleted post ${postId} on ${platform}`);
            }
            else {
                console.log(`[SCHEDULER] No jobs found for deleted post ${postId} on ${platform}`);
            }
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to cleanup jobs for deleted post ${postId} on ${platform}:`, error);
        }
    }
    async pause(platform) {
        try {
            await this.getQueue(platform).pause();
            console.log(`[SCHEDULER] Paused queue for ${platform}`);
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to pause queue for ${platform}:`, error);
            throw error;
        }
    }
    async resume(platform) {
        try {
            await this.getQueue(platform).resume();
            console.log(`[SCHEDULER] Resumed queue for ${platform}`);
        }
        catch (error) {
            console.error(`[SCHEDULER] Failed to resume queue for ${platform}:`, error);
            throw error;
        }
    }
    async close() {
        await Promise.all(Object.values(this.queues).map((queue) => queue.close()));
        console.log('[SCHEDULER] All queues closed');
    }
    // ========== HELPER METHODS ==========
    async findExistingJob(platform, postId, userId, socialAccountId) {
        try {
            const queue = this.getQueue(platform);
            // Check waiting jobs
            const waitingJobs = await queue.getWaiting();
            const existingWaiting = waitingJobs.find((job) => job.data.postId === postId &&
                job.data.userId === userId &&
                (!socialAccountId || job.data.socialAccountId === socialAccountId));
            if (existingWaiting)
                return existingWaiting;
            // Check delayed jobs
            const delayedJobs = await queue.getDelayed();
            const existingDelayed = delayedJobs.find((job) => job.data.postId === postId &&
                job.data.userId === userId &&
                (!socialAccountId || job.data.socialAccountId === socialAccountId));
            if (existingDelayed)
                return existingDelayed;
            // Check active jobs
            const activeJobs = await queue.getActive();
            const existingActive = activeJobs.find((job) => job.data.postId === postId &&
                job.data.userId === userId &&
                (!socialAccountId || job.data.socialAccountId === socialAccountId));
            if (existingActive)
                return existingActive;
            return null;
        }
        catch (error) {
            console.warn(`[SCHEDULER] Error checking for existing job:`, error);
            return null;
        }
    }
    // ========== QUOTA MANAGEMENT ==========
    async getQuotaStatus(platform, userId) {
        if (!this.limitsEnabled) {
            return {
                allowed: true,
                remainingQuota: Number.POSITIVE_INFINITY,
                resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            };
        }
        if (platform === 'youtube') {
            return await this.youtubeQuotaManager.getQuotaBudget(platform);
        }
        // For other platforms, use the rate limiter
        return await this.rateLimiter.checkRateLimit(platform, userId || '');
    }
    async getQuotaUsageStats(platform) {
        if (!this.limitsEnabled) {
            return {
                message: 'Quota limits are disabled',
                platform,
            };
        }
        if (platform === 'youtube') {
            return await this.youtubeQuotaManager.getQuotaUsageStats(platform);
        }
        return {
            message: `Quota stats not available for ${platform}`,
            platform,
        };
    }
}
exports.BullMqPostScheduler = BullMqPostScheduler;
