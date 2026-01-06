"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const zod_1 = require("zod");
const ai_schemas_1 = require("@/modules/ai/validation/ai.schemas");
const posts_schemas_1 = require("@/modules/post/schemas/posts.schemas");
const base_error_1 = require("@/shared/errors/base-error");
const error_codes_const_1 = require("@/shared/consts/error-codes.const");
const plans_1 = require("@/shared/consts/plans");
const SUPPORTED_PLATFORMS = [
    posts_schemas_1.SocilaMediaPlatform.TIKTOK,
    posts_schemas_1.SocilaMediaPlatform.INSTAGRAM,
    posts_schemas_1.SocilaMediaPlatform.THREADS,
    posts_schemas_1.SocilaMediaPlatform.BLUESKY,
    posts_schemas_1.SocilaMediaPlatform.LINKEDIN,
    posts_schemas_1.SocilaMediaPlatform.YOUTUBE,
];
const PLATFORM_LIMIT_KEYS = {
    [posts_schemas_1.SocilaMediaPlatform.TIKTOK]: { text: 'TIKTOK_CAPTION_LIMIT' },
    [posts_schemas_1.SocilaMediaPlatform.INSTAGRAM]: { text: 'INSTAGRAM_CAPTION_LIMIT' },
    [posts_schemas_1.SocilaMediaPlatform.THREADS]: { text: 'THREADS_TEXT_LIMIT' },
    [posts_schemas_1.SocilaMediaPlatform.BLUESKY]: { text: 'BLUESKY_POST_CHAR_LIMIT' },
    [posts_schemas_1.SocilaMediaPlatform.LINKEDIN]: { text: 'LINKEDIN_TEXT_LIMIT' },
    [posts_schemas_1.SocilaMediaPlatform.YOUTUBE]: {
        text: 'YOUTUBE_DESCRIPTION_LIMIT',
        title: 'YOUTUBE_TITLE_LIMIT',
    },
};
const AI_SYSTEM_PROMPT = `You are a content generation engine that MUST return a single JSON object ONLY, no markdown, no code fences, no prose. 
Follow the exact JSON schema and key order below. Never add extra keys. 
All strings must be plain text without markdown formatting unless explicitly requested.
Honor platform limits and constraints exactly. Rephrase to respect forbidden words.
Do not include tags right in text, we are hadling them on backend manually.

Output schema (and key order):
{
  "items": [
    {
      "platform": "tiktok" | "instagram" | "threads" | "bluesky" | "linkedin" | "youtube",
      "language": string,
      "title": string | null,
      "text": string,
      "hashtags": string[],
      "charCounts": { "title": number | null, "text": number },
      "warnings": string[]
    }
  ]
}

Platform capabilities:
- youtube: supports title + description (text). 
- tiktok: caption only (title = null).
- instagram: caption only (title = null).
- threads: text only (title = null); ALLOW MAX ONE HASHTAG total.
- bluesky: text only (title = null).
- linkedin: text only (title = null).

Hashtag rules:
- Provide relevant hashtags in target LANGUAGE when sensible.
- threads: MAX 1 hashtag.
- Others: 2-6 hashtags preferred.

Forbidden words:
- Never output words from the forbiddenWords list (case-insensitive). Rephrase if necessary.
- Add a note to "warnings" like "forbidden terms rephrased".

Length limits:
Use env values. If text exceeds limit -> compress or trim gracefully, append "..." if space allows, and log a warning.

Tone & language:
- Write in the requested language and tone.
- Integrate notesForAi meaningfully but concisely.

Determinism:
- Concise, actionable, platform-native text.
- Output only valid JSON object.`;
class AiResponseValidationError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'AiResponseValidationError';
    }
}
class AiService {
    constructor(apiClient, logger, userService, options) {
        this.apiClient = apiClient;
        this.logger = logger;
        this.userService = userService;
        this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || '';
        this.model = options?.model || process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini';
        this.envLimits = this.loadEnvLimits();
        const missingLimits = Object.entries(this.envLimits)
            .filter(([, value]) => !value || value === 'null')
            .map(([key]) => key);
        if (missingLimits.length > 0) {
            this.logger.warn('Some platform limits are not configured', {
                operation: 'ai_generate_content',
                missingLimits,
            });
        }
    }
    async generateIntroductoryCopy(userId, payload) {
        await this.ensureUserHasAiAccess(userId);
        if (!this.apiKey) {
            this.logger.error('OpenAI API key is not configured', {
                operation: 'ai_generate_content',
            });
            throw new base_error_1.BaseAppError('AI service is not configured', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 500);
        }
        this.ensureSupportedPlatforms(payload);
        const maxAttempts = 2;
        let lastValidationError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const isRepairAttempt = attempt > 1;
            try {
                const aiOutput = await this.fetchAndValidateResponse(payload, isRepairAttempt);
                const results = this.transformOutput(payload, aiOutput);
                this.ensureForbiddenCompliance(results, payload.forbiddenWords || []);
                this.logger.info('AI content generated successfully', {
                    operation: 'ai_generate_content',
                    attempt,
                    generatedItems: results.length,
                });
                return results;
            }
            catch (error) {
                if (error instanceof base_error_1.BaseAppError) {
                    throw error;
                }
                if (error instanceof AiResponseValidationError ||
                    error instanceof SyntaxError ||
                    error instanceof zod_1.ZodError) {
                    lastValidationError = error;
                    if (attempt < maxAttempts) {
                        this.logger.warn('AI response validation failed. Retrying with repair instruction.', {
                            operation: 'ai_generate_content',
                            attempt,
                            error: {
                                name: error instanceof Error ? error.name : 'UnknownError',
                                code: error instanceof base_error_1.BaseAppError
                                    ? error.code
                                    : error instanceof Error
                                        ? error.message
                                        : String(error),
                            },
                            details: error instanceof Error ? error.message : String(error),
                        });
                        continue;
                    }
                }
                this.logger.error('Failed to generate AI content', {
                    operation: 'ai_generate_content',
                    attempt,
                    error: {
                        name: error instanceof Error ? error.name : 'UnknownError',
                        code: error instanceof base_error_1.BaseAppError
                            ? error.code
                            : error instanceof Error
                                ? error.message
                                : String(error),
                    },
                    details: error instanceof Error ? error.message : String(error),
                });
                throw new base_error_1.BaseAppError('Failed to generate AI content', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 502);
            }
        }
        this.logger.error('AI response validation failed after retries', {
            operation: 'ai_generate_content',
            error: {
                name: lastValidationError instanceof Error ? lastValidationError.name : 'UnknownError',
                code: lastValidationError instanceof base_error_1.BaseAppError
                    ? lastValidationError.code
                    : lastValidationError instanceof Error
                        ? lastValidationError.message
                        : String(lastValidationError),
            },
            details: lastValidationError instanceof Error ? lastValidationError.message : String(lastValidationError),
        });
        throw new base_error_1.BaseAppError('Failed to generate AI content', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 502);
    }
    async ensureUserHasAiAccess(userId) {
        try {
            const plan = await this.userService.getUserPlan(userId);
            const normalizedPlanName = plan?.planName?.toUpperCase();
            if (normalizedPlanName !== plans_1.UserPlans.PRO) {
                throw new base_error_1.BaseAppError('AI features are available only on the Pro plan', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
            }
            await this.userService.incrementAiUsage(userId);
        }
        catch (error) {
            if (error instanceof base_error_1.BaseAppError && error.code === error_codes_const_1.ErrorCode.BAD_REQUEST) {
                throw new base_error_1.BaseAppError('AI features are available only on the Pro plan', error_codes_const_1.ErrorCode.FORBIDDEN, 403);
            }
            throw error;
        }
    }
    async fetchAndValidateResponse(payload, isRepairAttempt) {
        const messages = this.buildMessages(payload, isRepairAttempt);
        const requestBody = {
            model: this.model,
            temperature: 0.2,
            top_p: 0.9,
            response_format: { type: 'json_object' },
            messages,
        };
        let response;
        try {
            response = await this.apiClient.post('/chat/completions', requestBody, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
        }
        catch (error) {
            this.logger.error('OpenAI API request failed', {
                operation: 'ai_generate_content',
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    code: error instanceof base_error_1.BaseAppError
                        ? error.code
                        : error instanceof Error
                            ? error.message
                            : String(error),
                },
                details: error instanceof Error ? error.message : String(error),
            });
            throw new base_error_1.BaseAppError('Failed to contact AI provider', error_codes_const_1.ErrorCode.UNKNOWN_ERROR, 502);
        }
        const rawContent = response.choices?.[0]?.message?.content;
        if (!rawContent) {
            throw new AiResponseValidationError('OpenAI response did not include completion content');
        }
        try {
            return this.parseResponse(rawContent);
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                throw error;
            }
            throw new AiResponseValidationError('Failed to parse OpenAI response', error);
        }
    }
    parseResponse(rawContent) {
        const parsed = JSON.parse(rawContent);
        return ai_schemas_1.AiOutputSchema.parse(parsed);
    }
    buildMessages(payload, isRepairAttempt) {
        const messages = [
            {
                role: 'system',
                content: AI_SYSTEM_PROMPT,
            },
            {
                role: 'user',
                content: this.buildUserPrompt(payload),
            },
        ];
        if (isRepairAttempt) {
            messages.push({
                role: 'user',
                content: `REPAIR: The previous response failed JSON schema validation. Return a valid JSON object with exactly ${payload.selectedAccounts.length} item(s) in "items", matching the provided accounts order and platforms without extra keys.`,
            });
        }
        return messages;
    }
    buildUserPrompt(payload) {
        const includeHashtags = payload.includeHashtags ?? true;
        const notesForAi = payload.notesForAi ?? 'null';
        const forbiddenWordsJson = JSON.stringify(payload.forbiddenWords || []);
        const selectedAccountsJson = JSON.stringify(payload.selectedAccounts, null, 2);
        const limitsLines = [
            `- TIKTOK_CAPTION_LIMIT=${this.envLimits.TIKTOK_CAPTION_LIMIT}`,
            `- INSTAGRAM_CAPTION_LIMIT=${this.envLimits.INSTAGRAM_CAPTION_LIMIT}`,
            `- THREADS_TEXT_LIMIT=${this.envLimits.THREADS_TEXT_LIMIT}`,
            `- BLUESKY_POST_CHAR_LIMIT=${this.envLimits.BLUESKY_POST_CHAR_LIMIT}`,
            `- LINKEDIN_TEXT_LIMIT=${this.envLimits.LINKEDIN_TEXT_LIMIT}`,
            `- YOUTUBE_DESCRIPTION_LIMIT=${this.envLimits.YOUTUBE_DESCRIPTION_LIMIT}`,
            `- YOUTUBE_TITLE_LIMIT=${this.envLimits.YOUTUBE_TITLE_LIMIT}`,
        ].join('\n');
        return [
            'Generate social posts for these platforms as JSON only.',
            '',
            'INPUT:',
            `- tone: ${payload.tone}`,
            `- language: ${payload.language}`,
            `- includeHashtags: ${includeHashtags}`,
            `- notesForAi: ${notesForAi}`,
            `- forbiddenWords: ${forbiddenWordsJson}`,
            `- selectedAccounts: ${selectedAccountsJson}`,
            '',
            'ENV LIMITS:',
            limitsLines,
            '',
            'TASK:',
            'For each selected account, produce one item following the schema and constraints above.',
            'Respect forbidden words, tones, platform limits, and hashtag rules.',
            'Return only the JSON object per schema.',
        ].join('\n');
    }
    transformOutput(payload, aiOutput) {
        if (aiOutput.items.length !== payload.selectedAccounts.length) {
            throw new AiResponseValidationError(`AI response item count mismatch. Expected ${payload.selectedAccounts.length} but received ${aiOutput.items.length}.`);
        }
        return payload.selectedAccounts.map((account, index) => {
            const item = aiOutput.items[index];
            const normalizedPlatform = account.platform;
            if (item.platform !== normalizedPlatform) {
                this.logger.warn('AI response platform mismatch. Using request platform instead.', {
                    operation: 'ai_generate_content',
                    index,
                    requestedPlatform: normalizedPlatform,
                    receivedPlatform: item.platform,
                });
            }
            const sanitizedHashtags = this.sanitizeHashtags(normalizedPlatform, payload.includeHashtags === false ? [] : item.hashtags || []);
            const title = normalizedPlatform === posts_schemas_1.SocilaMediaPlatform.YOUTUBE ? item.title : null;
            const text = this.removeHashtagsFromText(item.text);
            const limitConfig = PLATFORM_LIMIT_KEYS[normalizedPlatform];
            const { adjustedTitle, adjustedText } = this.enforceCharLimits(limitConfig, title, text);
            const charCounts = {
                title: this.computeCharCount(adjustedTitle),
                text: Array.from(adjustedText).length,
            };
            const warnings = this.buildWarnings(item.warnings);
            return {
                id: account.id,
                platform: normalizedPlatform,
                language: item.language,
                title: adjustedTitle,
                text: adjustedText,
                hashtags: sanitizedHashtags,
                charCounts,
                warnings,
            };
        });
    }
    enforceCharLimits(limitConfig, title, text) {
        let adjustedTitle = title;
        let adjustedText = text;
        if (limitConfig?.text) {
            const textLimit = this.parseLimit(limitConfig.text);
            if (textLimit !== null) {
                const chars = Array.from(adjustedText);
                if (chars.length > textLimit) {
                    adjustedText = chars.slice(0, textLimit).join('');
                }
            }
        }
        if (limitConfig?.title && adjustedTitle) {
            const titleLimit = this.parseLimit(limitConfig.title);
            if (titleLimit !== null) {
                const chars = Array.from(adjustedTitle);
                if (chars.length > titleLimit) {
                    adjustedTitle = chars.slice(0, titleLimit).join('');
                }
            }
        }
        return {
            adjustedTitle,
            adjustedText,
        };
    }
    sanitizeHashtags(platform, hashtags) {
        if (!hashtags || hashtags.length === 0)
            return [];
        if (platform === posts_schemas_1.SocilaMediaPlatform.THREADS) {
            return hashtags.slice(0, 1);
        }
        return hashtags;
    }
    computeCharCount(value) {
        if (value === null || typeof value !== 'string') {
            return value === '' ? 0 : null;
        }
        return Array.from(value).length;
    }
    buildWarnings(baseWarnings) {
        return [...(baseWarnings || [])];
    }
    parseLimit(key) {
        const raw = this.envLimits[key];
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }
        return parsed;
    }
    ensureForbiddenCompliance(results, forbiddenWords) {
        if (!forbiddenWords || forbiddenWords.length === 0)
            return;
        const processedForbiddenWords = forbiddenWords
            .map((word) => ({
            original: word,
            normalized: word.trim().toLowerCase(),
        }))
            .filter((item) => item.normalized.length > 0);
        if (processedForbiddenWords.length === 0)
            return;
        for (const result of results) {
            const combinedContent = [result.title ?? '', result.text, ...(result.hashtags || [])]
                .join(' ')
                .toLowerCase();
            const offendingWords = processedForbiddenWords.filter((word) => combinedContent.includes(word.normalized));
            if (offendingWords.length > 0) {
                this.logger.warn('Generated content contains forbidden terms', {
                    operation: 'ai_generate_content',
                    forbiddenWords: offendingWords.map((word) => word.original),
                });
                throw new base_error_1.BaseAppError(`Generated content contains forbidden terms: ${offendingWords
                    .map((word) => word.original)
                    .join(', ')}`, error_codes_const_1.ErrorCode.CONTENT_VALIDATION_FAILED, 400);
            }
        }
    }
    ensureSupportedPlatforms(payload) {
        const unsupported = payload.selectedAccounts
            .map((account) => account.platform)
            .filter((platform) => !SUPPORTED_PLATFORMS.includes(platform));
        if (unsupported.length > 0) {
            throw new base_error_1.BaseAppError(`Unsupported platform(s) for AI generation: ${Array.from(new Set(unsupported)).join(', ')}`, error_codes_const_1.ErrorCode.BAD_REQUEST, 400);
        }
    }
    loadEnvLimits() {
        return {
            TIKTOK_CAPTION_LIMIT: process.env.TIKTOK_CAPTION_LIMIT?.trim() || 'null',
            INSTAGRAM_CAPTION_LIMIT: process.env.INSTAGRAM_CAPTION_LIMIT?.trim() || 'null',
            THREADS_TEXT_LIMIT: process.env.THREADS_TEXT_LIMIT?.trim() || 'null',
            BLUESKY_POST_CHAR_LIMIT: process.env.BLUESKY_POST_CHAR_LIMIT?.trim() || 'null',
            LINKEDIN_TEXT_LIMIT: process.env.LINKEDIN_TEXT_LIMIT?.trim() || 'null',
            YOUTUBE_DESCRIPTION_LIMIT: process.env.YOUTUBE_DESCRIPTION_LIMIT?.trim() || 'null',
            YOUTUBE_TITLE_LIMIT: process.env.YOUTUBE_TITLE_LIMIT?.trim() || 'null',
        };
    }
    removeHashtagsFromText(originalText) {
        if (!originalText)
            return '';
        const withoutHashtags = originalText.replace(/(^|\s)(#[^\s#]+)/g, (_match, prefix) => prefix);
        return withoutHashtags.replace(/\s{2,}/g, ' ').trim();
    }
}
exports.AiService = AiService;
