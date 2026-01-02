# Inspirations System - Architecture Overview

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERACTION                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API ENDPOINTS (Express)                          │
│                                                                          │
│  POST   /workspaces/:id/inspirations    ← Create inspiration           │
│  GET    /workspaces/:id/inspirations    ← List inspirations            │
│  GET    /inspirations/:id               ← Get details                  │
│  PUT    /inspirations/:id               ← Update description           │
│  DELETE /inspirations/:id               ← Delete inspiration           │
│                                                                          │
│  GET    /workspaces/:id/tags            ← List tags                    │
│  POST   /workspaces/:id/tags            ← Create tag                   │
│  PUT    /workspaces/:id/tags/:tagId     ← Update tag                   │
│  DELETE /workspaces/:id/tags/:tagId     ← Delete tag                   │
│                                                                          │
│  GET    /workspaces/:id/prompt          ← Get main prompt              │
│  PUT    /workspaces/:id/prompt          ← Update main prompt           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONTROLLER LAYER                                  │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐                   │
│  │ InspirationsController│  │WorkspaceTagsController│                   │
│  └──────────────────────┘  └──────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                    │
│                                                                          │
│  ┌─────────────────────┐  ┌──────────────────────┐                    │
│  │  InspirationsService │  │ WorkspaceTagsService │                    │
│  │  ─────────────────── │  │ ──────────────────── │                    │
│  │  • createInspiration │  │  • getTags           │                    │
│  │  • getInspirations   │  │  • createTag         │                    │
│  │  • updateInspiration │  │  • syncTagsFrom      │                    │
│  │  • deleteInspiration │  │    Extraction        │                    │
│  │  • checkDuplicate    │  │  • updateTag         │                    │
│  └─────────────────────┘  └──────────────────────┘                    │
│                                                                          │
│  ┌─────────────────────┐  ┌──────────────────────┐                    │
│  │ContentParserService │  │LlmExtractionService  │                    │
│  │  ─────────────────  │  │ ──────────────────── │                    │
│  │  • parseUrl         │  │  • createExtraction  │                    │
│  │  • parseDocument    │  │  • buildPrompt       │                    │
│  │  • extractVideo     │  │                      │                    │
│  │    Metadata         │  │                      │                    │
│  │  • normalizeContent │  │                      │                    │
│  └─────────────────────┘  └──────────────────────┘                    │
│                                                                          │
│  ┌─────────────────────┐                                               │
│  │  WorkspaceService   │                                               │
│  │  ─────────────────  │                                               │
│  │  • getMainPrompt    │                                               │
│  │  • updateMainPrompt │                                               │
│  └─────────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      REPOSITORY LAYER (Data Access)                      │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐                   │
│  │ InspirationsRepository│  │WorkspaceTagsRepository│                   │
│  │  ───────────────────  │  │ ────────────────────  │                   │
│  │  • create             │  │  • findByWorkspace   │                   │
│  │  • findById           │  │  • create            │                   │
│  │  • findByWorkspaceId  │  │  • update            │                   │
│  │  • update             │  │  • delete            │                   │
│  │  • delete             │  │  • incrementUsage    │                   │
│  │  • checkDuplicateUrl  │  │                      │                   │
│  └──────────────────────┘  └──────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL)                              │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │ rawInspirations  │  │  inspirations    │  │  workspaceTags   │    │
│  │                  │  │   Extractions    │  │                  │    │
│  │ • id             │  │                  │  │ • id             │    │
│  │ • workspaceId    │  │ • id             │  │ • workspaceId    │    │
│  │ • userId         │  │ • rawInspirationId│  │ • name           │    │
│  │ • type           │  │ • workspaceId    │  │ • category       │    │
│  │ • content        │  │ • summary        │  │ • usageCount     │    │
│  │ • imageUrl       │  │ • keyTopics      │  │ • isUserCreated  │    │
│  │ • userDescription│  │ • contentFormat  │  │                  │    │
│  │ • metadata       │  │ • tone           │  │                  │    │
│  │ • parsedContent  │  │ • targetAudience │  │                  │    │
│  │ • status         │  │ • keyInsights    │  │                  │    │
│  │ • errorMessage   │  │ • contentStructure│ │                  │    │
│  └──────────────────┘  │ • visualStyle    │  └──────────────────┘    │
│                         │ • suggestedTags  │                           │
│  ┌──────────────────┐  │ • llmModel       │                           │
│  │   workspaces     │  │ • tokensUsed     │                           │
│  │                  │  └──────────────────┘                           │
│  │ • id             │                                                  │
│  │ • userId         │                                                  │
│  │ • name           │                                                  │
│  │ • mainPrompt ◄───┼── NEW FIELD (JSONB)                             │
│  └──────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND PROCESSING (BullMQ)                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Queue: inspirations:process                                     │  │
│  │                                                                  │  │
│  │  Job Payload: { inspirationId: string }                         │  │
│  │                                                                  │  │
│  │  Worker Process:                                                │  │
│  │  ───────────────                                                │  │
│  │  1. Fetch rawInspiration from DB                                │  │
│  │  2. Parse content (ContentParserService)                        │  │
│  │     ├─ HTML/URL → extract text, metadata                        │  │
│  │     ├─ PDF → extract text                                       │  │
│  │     ├─ DOCX → extract text                                      │  │
│  │     └─ YouTube → extract metadata                               │  │
│  │  3. Normalize content (max 1500 words)                          │  │
│  │  4. Save parsedContent to DB                                    │  │
│  │  5. Create extraction via OpenAI (LlmExtractionService)         │  │
│  │  6. Save extraction to DB                                       │  │
│  │  7. Sync workspace tags (WorkspaceTagsService)                  │  │
│  │     ├─ Create new tags if not exist                             │  │
│  │     └─ Increment usageCount for existing tags                   │  │
│  │  8. Update status to "completed"                                │  │
│  │                                                                  │  │
│  │  Error Handling:                                                │  │
│  │  ───────────────                                                │  │
│  │  • Retry: 3 attempts with exponential backoff                   │  │
│  │  • On failure: update status to "failed" + errorMessage         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                                  │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │  OpenAI API  │  │   AWS S3     │  │  Web Scraping│                 │
│  │  ──────────  │  │  ──────────  │  │  ──────────  │                 │
│  │  • GPT-4o    │  │  • Image     │  │  • cheerio   │                 │
│  │  • Extract   │  │    upload    │  │  • pdf-parse │                 │
│  │    insights  │  │  • Document  │  │  • mammoth   │                 │
│  │  • Summarize │  │    upload    │  │              │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Creating an Inspiration

### Step-by-Step Process

```
1. User Action
   └─► POST /workspaces/:id/inspirations
       Body: { type: "link", content: "https://...", userDescription: "..." }

2. Controller (InspirationsController)
   └─► Validate request (Zod schema)
   └─► Call InspirationsService.createInspiration()

3. Service (InspirationsService)
   └─► Check duplicate URL (if type=link)
   │   └─► If duplicate → throw 409 error
   │
   └─► Upload file to S3 (if type=image/document)
   │   └─► Get imageUrl from S3
   │
   └─► Save to DB (InspirationsRepository.create)
   │   └─► Status: "processing"
   │
   └─► Add job to BullMQ queue
   │   └─► Queue: "inspirations:process"
   │   └─► Payload: { inspirationId: "..." }
   │
   └─► Return inspiration object

4. Response to User
   └─► 201 Created
       {
         id: "...",
         status: "processing",
         ...
       }

5. Background Worker (BullMQ)
   └─► Pick job from queue
   │
   └─► Fetch inspiration from DB
   │
   └─► Parse Content (ContentParserService)
   │   ├─► type=link: parse HTML, extract text, metadata
   │   ├─► type=document: extract text from PDF/DOCX
   │   ├─► type=image: skip parsing
   │   └─► type=text: skip parsing
   │
   └─► Normalize content (max 1500 words)
   │
   └─► Save parsedContent to DB
   │
   └─► Create Extraction (LlmExtractionService)
   │   └─► Build prompt for OpenAI
   │   └─► Call OpenAI API (gpt-4o)
   │   └─► Parse JSON response
   │   └─► {
   │         summary: "...",
   │         keyTopics: [...],
   │         contentFormat: "...",
   │         tone: [...],
   │         targetAudience: "...",
   │         keyInsights: [...],
   │         contentStructure: "...",
   │         visualStyle: "...",
   │         suggestedTags: [...]
   │       }
   │
   └─► Save extraction to DB (inspirationsExtractions table)
   │
   └─► Sync Workspace Tags (WorkspaceTagsService)
   │   └─► For each suggestedTag:
   │       ├─► Determine category (topic/format/tone/style)
   │       ├─► Check if tag exists
   │       │   ├─► If exists: increment usageCount
   │       │   └─► If not: create new tag (isUserCreated=false, usageCount=1)
   │
   └─► Update inspiration status to "completed"

6. User Polls for Status (or WebSocket notification)
   └─► GET /inspirations/:id
   └─► Response:
       {
         id: "...",
         status: "completed",
         extraction: { ... },
         ...
       }
```

---

## Data Relationships

```
users
  │
  └─► workspaces (1:N)
       │
       ├─► mainPrompt (1:1, JSONB field)
       │
       ├─► rawInspirations (1:N)
       │    │
       │    └─► inspirationsExtractions (1:1)
       │
       └─► workspaceTags (1:N)
            │
            ├─► Auto-generated from inspirations
            └─► User-created manually
```

**Cascade Deletes:**
- Delete user → delete all workspaces → delete all inspirations/tags
- Delete workspace → delete all inspirations → delete all extractions
- Delete workspace → delete all tags
- Delete inspiration → delete extraction

---

## Main Prompt Structure

```json
{
  "brandVoice": "Professional yet approachable, data-driven with storytelling",
  "coreThemes": [
    "marketing automation",
    "growth strategies",
    "analytics"
  ],
  "targetAudience": "B2B SaaS marketers and founders, 25-45 years old",
  "contentGoals": [
    "educate",
    "inspire action",
    "build authority"
  ],
  "avoidTopics": [
    "politics",
    "religion"
  ],
  "preferredFormats": [
    "carousel",
    "short video",
    "thread"
  ],
  "additionalContext": "Focus on actionable insights, include data when possible",
  "updatedAt": "2025-01-02T12:00:00Z"
}
```

---

## Workspace Tags System

### Tag Categories

1. **Topic** — тематика контента
   - Examples: "marketing", "sales", "growth", "analytics", "AI"

2. **Format** — формат контента
   - Examples: "video", "carousel", "thread", "infographic", "article"

3. **Tone** — тон общения
   - Examples: "professional", "casual", "humorous", "inspirational", "educational"

4. **Style** — стиль контента
   - Examples: "minimalist", "bold", "storytelling", "data-driven", "visual-heavy"

5. **Other** — прочие теги
   - Examples: любые специфичные теги, не попадающие в категории выше

### Auto-generation Logic

```
Inspiration processed
  └─► OpenAI returns suggestedTags: ["marketing", "carousel", "professional", "data-driven"]
       │
       └─► For each tag:
            │
            ├─► Determine category (эвристика по ключевым словам)
            │    ├─ "marketing", "sales", "growth" → topic
            │    ├─ "carousel", "video", "thread" → format
            │    ├─ "professional", "casual" → tone
            │    └─ "data-driven", "minimalist" → style
            │
            ├─► Check if tag exists in workspace
            │    │
            │    ├─► If exists:
            │    │    └─► Increment usageCount
            │    │
            │    └─► If not exists:
            │         └─► Create new tag
            │              • name: "marketing"
            │              • category: "topic"
            │              • usageCount: 1
            │              • isUserCreated: false
            │
            └─► Save/update in DB
```

### User Management

Users can:
- ✅ View all tags (sorted by usageCount or name)
- ✅ Create custom tags manually (isUserCreated=true)
- ✅ Edit tag names
- ✅ Delete tags
- ❌ Cannot change usageCount manually (auto-managed)

---

## Security Considerations

### 1. Authentication & Authorization
- All endpoints require JWT token
- Verify user has access to workspace
- Check ownership before update/delete operations

### 2. File Upload Security
- Whitelist file extensions: jpg, png, webp, pdf, txt, md, docx
- Verify MIME type (don't trust extension alone)
- Max file size: 50MB
- Store in S3 with private access (signed URLs for retrieval)

### 3. SSRF Protection (Server-Side Request Forgery)
When parsing URLs, block access to:
- `127.0.0.0/8` (localhost)
- `10.0.0.0/8` (private network)
- `172.16.0.0/12` (private network)
- `192.168.0.0/16` (private network)
- `169.254.0.0/16` (link-local)

### 4. Input Validation
- Zod schemas for all requests
- Sanitize HTML content before parsing
- Limit content length (1500 words)
- Timeout for external requests (30s)

### 5. Rate Limiting (Optional, Phase 2+)
- Max 50 inspirations per hour per workspace
- Max 5 concurrent processing jobs per workspace

---

## Performance Considerations

### Database Indexes

```sql
-- rawInspirations
CREATE INDEX idx_raw_inspirations_workspace ON raw_inspirations(workspace_id, created_at DESC);
CREATE INDEX idx_raw_inspirations_status ON raw_inspirations(workspace_id, status);
CREATE UNIQUE INDEX idx_raw_inspirations_url ON raw_inspirations(workspace_id, content) WHERE type = 'link';

-- inspirationsExtractions
CREATE INDEX idx_inspirations_extractions_workspace ON inspirations_extractions(workspace_id, created_at DESC);
CREATE INDEX idx_inspirations_extractions_raw ON inspirations_extractions(raw_inspiration_id);

-- workspaceTags
CREATE UNIQUE INDEX idx_workspace_tags_unique ON workspace_tags(workspace_id, name, category);
CREATE INDEX idx_workspace_tags_usage ON workspace_tags(workspace_id, usage_count DESC);
```

### Caching (Optional, Future)
- Cache workspace tags (Redis, TTL: 5 min)
- Cache main prompt (Redis, TTL: 10 min)
- Invalidate on update

### Query Optimization
- Paginate inspirations list (limit/offset or cursor-based)
- Use `SELECT` only required fields
- Join extractions only when needed (GET /inspirations/:id)

---

## Error Handling Strategy

### API Errors
```typescript
{
  400: "Bad Request" → Invalid input, validation failed
  401: "Unauthorized" → Missing or invalid JWT token
  403: "Forbidden" → User doesn't have access to workspace
  404: "Not Found" → Inspiration/tag not found
  409: "Conflict" → Duplicate URL or tag
  413: "Payload Too Large" → File > 50MB
  415: "Unsupported Media Type" → Invalid file type
  500: "Internal Server Error" → Unexpected error
}
```

### Worker Errors
- Parsing timeout (30s) → Save with empty parsedContent, continue
- OpenAI API error → Retry 3 times (5s, 30s, 2min)
- All retries failed → Set status="failed", save errorMessage
- Notify user (optional: email/push notification)

### Logging
Log all important events:
- Inspiration created (userId, workspaceId, type)
- Parsing started/completed/failed (duration, error)
- OpenAI request (model, tokens, cost, duration)
- Tags synced (added/updated tags count)
- Status updated (processing → completed/failed)

---

## Future: Integration with Post Generation

When user generates a post using AI (Phase 5):

```
User: "Generate a post about AI in marketing"
  │
  └─► AI Service receives request
       │
       ├─► Fetch workspace context:
       │    ├─ mainPrompt (brandVoice, targetAudience, etc)
       │    ├─ Top 20 workspace tags (by usageCount)
       │    └─ Last 10 inspirations extractions (summaries, insights)
       │
       └─► Build enhanced prompt:

           === Workspace Context ===
           Brand Voice: {mainPrompt.brandVoice}
           Target Audience: {mainPrompt.targetAudience}
           Core Themes: {mainPrompt.coreThemes}

           === Common Tags ===
           {tags.map(t => t.name).join(', ')}

           === Recent Inspirations ===
           1. {extraction1.summary}
              Key Insights: {extraction1.keyInsights}
           2. {extraction2.summary}
              Key Insights: {extraction2.keyInsights}
           ...

           === User Request ===
           Generate a post about: {userInput}
           Platform: {platform}

           === Output ===
           Create a post that matches the brand voice and incorporates
           insights from past inspirations...
```

This ensures AI-generated content is consistent with the workspace's style and accumulated knowledge.

---

**End of Architecture Overview**

