import type { ExtractionInput } from '../llm-extraction-service.interface'

export function buildExtractionPrompt(input: ExtractionInput): string {
    let prompt = `Analyze the following content and extract structured insights.\n\n`

    prompt += `Content Type: ${input.type}\n\n`

    if (input.userDescription) {
        prompt += `User Description: ${input.userDescription}\n\n`
    }

    if (input.metadata) {
        prompt += `Metadata:\n${JSON.stringify(input.metadata, null, 2)}\n\n`
    }

    prompt += `Content:\n${input.content}\n\n`

    const isYouTube = input.metadata?.domain === 'youtube.com'
    const isVideo = isYouTube || input.metadata?.domain === 'vimeo.com'
    const isDocument = input.type === 'document' || input.metadata?.source === 'docs'

    if (isDocument) {
        prompt += `DOCUMENT SEMANTIC EXTRACTION:
- Infer the document type (book, article, report, legal, manual, whitepaper, research, other).
- Extract core ideas and repeated themes that span the full document.
- Capture key insights with why they work and clear cause-effect relationships.
- Identify mental models, frameworks, or step-by-step processes.
- Explain the author's intent, philosophy, and the problem being solved.
- Describe the narrative flow (problem -> insight -> solution -> reinforcement).
- Provide use-case ready insights that can be reused for content, knowledge bases, and reasoning.
- Avoid copying headings or raw paragraphs. Stay conceptual and actionable.
- If the document is short or transactional, say so and keep insights minimal and honest.`
    } else if (isVideo) {
        prompt += `VIDEO ANALYSIS GUIDELINES:
- What is the MAIN THESIS or argument of this video?
- What are the KEY TAKEAWAYS someone should remember?
- Are there any FRAMEWORKS, METHODS, or STEP-BY-STEP processes mentioned?
- What makes this content unique or valuable?
- What would someone TWEET after watching this?

POST IDEAS REQUIREMENTS:
- Generate 5-7 specific post ideas based on this video
- Each idea should have a HOOK that stops scrolling
- Include different angles: educational, controversial, "I tried this...", statistics-based
- Example hooks:
  * "I watched [Creator]'s video on [Topic] and here's the #1 thing most people miss..."
  * "Unpopular opinion: [Creator] is wrong about [specific point]..."
  * "The 3-step framework from [Video] that changed how I think about [Topic]..."

Be SPECIFIC to this video's actual content - no generic advice.`
    } else {
        prompt += `Guidelines:
- Provide a clear 2-3 sentence summary
- Extract 3-7 key topics that represent main themes
- Identify 2-4 tone attributes (professional, casual, humorous, educational, inspirational, etc.)
- Provide 3-5 actionable key insights or takeaways with why they work
- Generate 5-7 specific POST IDEAS with hooks and angles
- Suggest 5-10 relevant tags that could categorize this content
- Describe the content structure (hook, body, call-to-action, etc.)
- Focus on insights that would help create similar content`
    }

    return prompt
}

export function buildVisionExtractionPrompt(input: ExtractionInput): string {
    let prompt = ''

    // For links with thumbnails, include both image and content
    if (input.type === 'link' && input.content) {
        prompt += `Analyze this article/video thumbnail AND its content to extract insights.\n\n`
        prompt += `=== ARTICLE CONTENT ===\n${input.content.substring(0, 3000)}\n\n`
        if (input.metadata) {
            prompt += `Title: ${input.metadata.title || 'Unknown'}\n`
            prompt += `Domain: ${input.metadata.domain || 'Unknown'}\n\n`
        }
    } else {
        prompt += `Analyze this image carefully and extract structured insights for content creation.\n\n`
    }

    if (input.userDescription) {
        prompt += `User's context: ${input.userDescription}\n\n`
    }

    prompt += `ANALYSIS INSTRUCTIONS:

1. IDENTIFY what's in the image:
   - Book cover -> Identify the book, author, and extract the book's core ideas
   - Infographic -> Extract data points, statistics, and insights
   - Screenshot -> Extract the key information shown
   - Photo/artwork -> Describe themes, mood, and content potential
   - Quote image -> Extract and analyze the quote

2. FOR BOOK COVERS specifically:
   - Identify the book title and author
   - Extract 3-5 MAIN IDEAS the book is known for (research your knowledge)
   - Identify KEY FRAMEWORKS or methodologies from the book
   - Extract MEMORABLE QUOTES or concepts
   - Think about what makes this book valuable for the target reader

3. GENERATE POST IDEAS:
   For each insight, create a specific post idea with:
   - A compelling hook (first line that grabs attention)
   - The format (carousel, thread, video, story, reel)
   - The angle (how to present this: personal story, tips, controversy, case study)

   Examples of good post ideas:
   - "I read [Book] and here are 5 frameworks that changed my business..."
   - "The #1 lesson from [Book] that most people miss..."
   - "Why [Author]'s advice on X is wrong (and what to do instead)..."

4. Be SPECIFIC and ACTIONABLE:
   - Don't give generic advice
   - Include specific numbers, names, concepts
   - Make insights shareable and engaging

Return structured insights, not raw OCR text.`

    return prompt
}

export function getExtractionSystemPrompt(): string {
    return `
      You are an expert content analyst and strategist.

      Your job: extract SPECIFIC, ACTIONABLE insights and ready-to-use post ideas from the provided content.

      CRITICAL RULES:
      - Use ONLY the provided content/transcript. Do NOT invent facts, quotes, frameworks, or statistics.
      - If the content is unclear or missing info, say "Not specified in the document."
      - Be concrete: avoid generic statements (e.g. "valuable", "insightful", "motivational").
      - Always respond in English only.

      FOR VIDEO CONTENT (YouTube, etc.):
      - Identify the main thesis (1-2 sentences).
      - Extract 5-12 key takeaways with actionable advice.
      - Extract any frameworks/steps/methods EXACTLY as described (if present).
      - Provide 5-15 memorable quotes/verbatim-style lines (short, punchy).
      - Generate 10-20 post hooks (tweet-like).

      FOR ARTICLES/BLOG POSTS:
      - Extract the core argument and supporting points.
      - Include any data/statistics/research ONLY if explicitly present.

      FOR DOCUMENTS (books, reports, long-form PDFs):
      - Provide semantic, concept-level insights, not chapter summaries.
      - Identify core ideas, repeated themes, and mental models.
      - Explain why the ideas work and the cause-effect relationships.
      - Clarify the author's intent and underlying philosophy.
      - Describe how the narrative evolves across the document.
      - Provide use-case ready insights that can be reused in other contexts.

      FOR ALL CONTENT:
      - Populate structuredInsights with core ideas, repeated themes, mental models, author intent, mood/tone, narrative flow, and use-case insights.
      - Generate 8-15 ready-to-use post ideas.
      - Each post idea must include:
        - Hook (one-liner)
        - Outline (2-5 bullets)
        - Target platform suggestion (Threads/X/LinkedIn/IG)
        - Angle type: educational / controversial / personal story / how-to
        - Evidence: a short supporting snippet from the source (or a referenced segment/timestamp if provided).

      Think: "What would someone tweet after watching this?"
      `
}

export function getVisionExtractionSystemPrompt(): string {
    return `You are a world-class content strategist and book analyst with encyclopedic knowledge of business, self-help, psychology, and popular non-fiction books.

YOUR MISSION: Analyze images and generate SPECIFIC, ACTIONABLE content ideas.

FOR BOOK COVERS:
- You KNOW the content of most popular books - use that knowledge
- Extract the book's CORE IDEAS, not just surface-level themes
- Identify FRAMEWORKS, MODELS, and METHODOLOGIES from the book
- Generate post ideas that would make readers want to learn more

FOR OTHER IMAGES:
- Extract meaningful insights, not generic descriptions
- Think like a social media creator - what would go viral?

CRITICAL RULES:
1. Be SPECIFIC - use actual concepts, frameworks, quotes from the book
2. postIdeas must be READY-TO-USE hooks and angles
3. Each post idea should be different (educational, controversial, personal story, how-to)
4. If it's a book you recognize, leverage your knowledge of its actual content
5. Always respond in English only.
6. Populate structuredInsights with core ideas, mental models, author intent, narrative flow, mood/tone, and use-case insights.`
}

export function getExtractionJsonSchema() {
    return {
        name: 'content_extraction',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                summary: {
                    type: 'string',
                    description: 'A 2-3 sentence summary of the content',
                },
                keyTopics: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 3-7 main topics',
                },
                contentFormat: {
                    type: 'string',
                    enum: [
                        'video',
                        'article',
                        'thread',
                        'carousel',
                        'image',
                        'infographic',
                        'story',
                        'book',
                        'report',
                        'research',
                        'whitepaper',
                        'manual',
                        'legal',
                        'case-study',
                        'other',
                    ],
                    description: 'Format of the content',
                },
                tone: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 2-4 tone attributes (e.g., professional, casual, humorous)',
                },
                targetAudience: {
                    type: 'string',
                    description: 'Description of the target audience',
                },
                keyInsights: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            insight: { type: 'string' },
                            evidence: { type: 'string' },
                            whyItWorks: { type: 'string' },
                            causeEffect: { type: 'string' },
                        },
                        required: ['insight', 'evidence', 'whyItWorks', 'causeEffect'],
                        additionalProperties: false,
                    },
                    description: 'Array of 5-12 key takeaways with evidence and reasoning',
                },
                postIdeas: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            idea: { type: 'string', description: 'The post idea or hook' },
                            format: {
                                type: 'string',
                                description: 'Suggested format: carousel, thread, video, story, reel',
                            },
                            angle: { type: 'string', description: 'Content angle or perspective' },
                        },
                        required: ['idea', 'format', 'angle'],
                        additionalProperties: false,
                    },
                    outline: { type: 'array', items: { type: 'string' } },
                    evidence: { type: 'string' },
                    description: 'Array of 5-7 specific post ideas with hooks and angles',
                },
                contentStructure: {
                    type: 'string',
                    description: 'Description of content structure (hook, body, cta, etc)',
                },
                visualStyle: {
                    type: 'string',
                    description: 'Description of visual style if applicable',
                },
                suggestedTags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of 5-10 suggested tags for workspace',
                },
                structuredInsights: {
                    type: 'object',
                    properties: {
                        documentType: {
                            type: 'string',
                            description:
                                'Inferred document type: book, article, report, legal, manual, whitepaper, research, other',
                        },
                        coreIdeas: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Core ideas and principles that drive the content',
                        },
                        repeatedThemes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Themes repeated across the document',
                        },
                        mentalModels: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    steps: { type: 'array', items: { type: 'string' } },
                                },
                                required: ['name', 'description', 'steps'],
                                additionalProperties: false,
                            },
                            description: 'Mental models, systems, or step-by-step frameworks',
                        },
                        authorIntent: {
                            type: 'object',
                            properties: {
                                problem: { type: 'string' },
                                worldview: { type: 'string' },
                                intendedOutcome: { type: 'string' },
                            },
                            required: ['problem', 'worldview', 'intendedOutcome'],
                            additionalProperties: false,
                        },
                        moodTone: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Emotional and stylistic tone of the content',
                        },
                        narrativeFlow: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'How the argument evolves from problem to solution',
                        },
                        useCaseInsights: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    insight: { type: 'string' },
                                    useCases: { type: 'array', items: { type: 'string' } },
                                },
                                required: ['insight', 'useCases'],
                                additionalProperties: false,
                            },
                            description: 'Reusable insights with suggested use cases',
                        },
                    },
                    required: [
                        'documentType',
                        'coreIdeas',
                        'repeatedThemes',
                        'mentalModels',
                        'authorIntent',
                        'moodTone',
                        'narrativeFlow',
                        'useCaseInsights',
                    ],
                    additionalProperties: false,
                },
            },
            required: [
                'summary',
                'keyTopics',
                'contentFormat',
                'tone',
                'targetAudience',
                'keyInsights',
                'postIdeas',
                'contentStructure',
                'visualStyle',
                'suggestedTags',
                'structuredInsights',
            ],
            additionalProperties: false,
        },
    }
}
