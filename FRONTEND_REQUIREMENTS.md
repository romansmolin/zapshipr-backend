# Frontend Requirements - ZapShipr Backend API

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Workspaces](#workspaces)
4. [Inspirations System](#inspirations-system)
5. [Workspace Tags](#workspace-tags)
6. [Data Types](#data-types)
7. [Error Handling](#error-handling)

---

## Overview

ZapShipr Backend provides APIs for managing social media content across multiple platforms. The system includes workspace management, inspiration collection, AI-powered content analysis, and tag organization.

**Base URL**: `http://localhost:4000`

**Authentication**: Bearer token (JWT)

---

## Authentication

### Get User Info

Get current user information and plan details.

**Endpoint**: `GET /users/me`

**Headers**:
```
Authorization: Bearer {access_token}
```

**Response**:
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "avatarUrl": "https://...",
  "plan": "pro",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

## Workspaces

Workspaces are user-specific containers for organizing content, inspirations, and social accounts.

### Key Features
- ✅ Users create workspaces during onboarding (no default workspaces)
- ✅ First created workspace automatically becomes default
- ✅ Users can switch default workspace
- ✅ Each workspace has a customizable "Main Prompt" for AI guidance

---

### Create Workspace

**Endpoint**: `POST /workspaces`

**Request**:
```json
{
  "name": "My Brand",
  "description": "Personal brand workspace"
}
```

**Response**:
```json
{
  "id": "workspace-uuid",
  "userId": "user-uuid",
  "name": "My Brand",
  "description": "Personal brand workspace",
  "avatarUrl": null,
  "isDefault": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Notes**:
- First workspace automatically sets `isDefault: true`
- Subsequent workspaces have `isDefault: false` by default

---

### Get All Workspaces

**Endpoint**: `GET /workspaces`

**Response**:
```json
[
  {
    "id": "workspace-uuid",
    "userId": "user-uuid",
    "name": "My Brand",
    "description": "Personal brand workspace",
    "avatarUrl": null,
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Get Workspace by ID

**Endpoint**: `GET /workspaces/:id`

**Response**: Same as single workspace object above

---

### Get Default Workspace

**Endpoint**: `GET /workspaces/default`

**Response**: Same as single workspace object above

**Fallback Logic**:
- Returns workspace with `isDefault: true`
- If no default set but only 1 workspace exists → returns that workspace
- If no workspaces exist → returns `null`

---

### Update Workspace

**Endpoint**: `PUT /workspaces/:id`

**Request**:
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Response**: Updated workspace object

---

### Set Default Workspace

**Endpoint**: `PUT /workspaces/:id/default`

**Response**: Updated workspace object with `isDefault: true`

**Notes**:
- Automatically sets `isDefault: false` for other workspaces
- Only one default workspace per user

---

### Delete Workspace

**Endpoint**: `DELETE /workspaces/:id`

**Response**: `204 No Content`

---

### Get Main Prompt

**Endpoint**: `GET /workspaces/:id/prompt`

**Response**:
```json
{
  "brandVoice": "Professional, friendly, informative",
  "coreThemes": ["technology", "innovation", "startups"],
  "targetAudience": "Entrepreneurs and startup founders aged 25-45",
  "contentGoals": ["educate", "inspire", "build authority"],
  "avoidTopics": ["politics", "religion"],
  "preferredFormats": ["short-form video", "carousel posts", "threads"],
  "additionalContext": "Focus on actionable tips and real-world examples"
}
```

**Notes**:
- If no prompt is set, returns default empty values
- Used by LLM for content analysis and suggestions

---

### Update Main Prompt

**Endpoint**: `PUT /workspaces/:id/prompt`

**Request** (all fields optional):
```json
{
  "brandVoice": "Professional, friendly, informative",
  "coreThemes": ["technology", "innovation"],
  "targetAudience": "Entrepreneurs aged 25-45",
  "contentGoals": ["educate", "inspire"],
  "avoidTopics": ["politics"],
  "preferredFormats": ["video", "carousel"],
  "additionalContext": "Focus on actionable tips"
}
```

**Response**: Same as Get Main Prompt

**Notes**:
- Partial updates supported (only provided fields are updated)
- Merges with existing prompt data

---

## Inspirations System

The Inspirations System allows users to save and analyze content from various sources for future reference and content creation ideas.

### Flow Overview

```
User saves inspiration
    ↓
Created with status: "processing"
    ↓
Queued for background processing (BullMQ)
    ↓
Content Parser extracts text/metadata
    ↓
LLM (GPT-4o) analyzes content
    ↓
Status updated to "completed" or "failed"
    ↓
Tags automatically synced to workspace
```

---

### Inspiration Types

1. **text** - Plain text notes
2. **url** - Web pages, articles, blogs
3. **image** - Image with optional description
4. **video** - YouTube, Vimeo, TikTok, etc.
5. **document** - PDF, DOCX, TXT, MD files

---

### Create Inspiration

**Endpoint**: `POST /workspaces/:workspaceId/inspirations`

**Request Examples**:

#### Text Inspiration
```json
{
  "type": "text",
  "content": "Great insight: Always focus on user value first...",
  "userDescription": "Key principle for product design"
}
```

#### URL Inspiration
```json
{
  "type": "url",
  "content": "https://example.com/article",
  "userDescription": "Interesting article about growth hacking"
}
```

#### Image Inspiration
```json
{
  "type": "image",
  "imageUrl": "https://s3.amazonaws.com/...",
  "userDescription": "Great color scheme for social posts"
}
```

#### Video Inspiration
```json
{
  "type": "video",
  "content": "https://youtube.com/watch?v=...",
  "userDescription": "Tutorial on Instagram Reels"
}
```

#### Document Inspiration
```json
{
  "type": "document",
  "content": "https://s3.amazonaws.com/.../document.pdf",
  "userDescription": "Industry report Q4 2024"
}
```

**Response**:
```json
{
  "id": "inspiration-uuid",
  "workspaceId": "workspace-uuid",
  "userId": "user-uuid",
  "type": "url",
  "content": "https://example.com/article",
  "imageUrl": null,
  "userDescription": "Interesting article",
  "metadata": null,
  "parsedContent": null,
  "status": "processing",
  "errorMessage": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Get Inspirations

**Endpoint**: `GET /workspaces/:workspaceId/inspirations`

**Query Parameters**:
- `status` (optional): Filter by status (`processing`, `completed`, `failed`)
- `type` (optional): Filter by type (`text`, `url`, `image`, `video`, `document`)
- `limit` (optional): Number of results (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example**: `GET /workspaces/:id/inspirations?status=completed&type=url&limit=10`

**Response**:
```json
[
  {
    "id": "inspiration-uuid",
    "workspaceId": "workspace-uuid",
    "userId": "user-uuid",
    "type": "url",
    "content": "https://example.com/article",
    "imageUrl": null,
    "userDescription": "Interesting article",
    "metadata": {
      "title": "How to Build a Startup",
      "description": "Complete guide...",
      "imageUrl": "https://...",
      "siteName": "TechCrunch"
    },
    "parsedContent": {
      "textContent": "Article full text...",
      "wordCount": 1500
    },
    "status": "completed",
    "errorMessage": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "extraction": {
      "summary": "This article discusses startup fundamentals...",
      "keyTopics": ["startups", "fundraising", "product-market fit"],
      "contentFormat": "article",
      "tone": ["professional", "educational"],
      "targetAudience": "Aspiring entrepreneurs",
      "keyInsights": [
        "Focus on solving real problems",
        "Build MVP first",
        "Talk to customers early"
      ],
      "contentStructure": "Problem → Solution → Case Studies → Actionable Tips",
      "visualStyle": null,
      "suggestedTags": ["startup", "entrepreneurship", "mvp", "fundraising"]
    }
  }
]
```

---

### Get Inspiration by ID

**Endpoint**: `GET /workspaces/:workspaceId/inspirations/:id`

**Response**: Single inspiration object (same structure as above)

---

### Update Inspiration

**Endpoint**: `PUT /workspaces/:workspaceId/inspirations/:id`

**Request** (all fields optional):
```json
{
  "userDescription": "Updated description",
  "content": "Updated content"
}
```

**Response**: Updated inspiration object

**Notes**:
- Cannot update `type`, `status`, `parsedContent`, or `metadata`
- These are managed by the system

---

### Delete Inspiration

**Endpoint**: `DELETE /workspaces/:workspaceId/inspirations/:id`

**Response**: `204 No Content`

---

### LLM Extraction Data Structure

When an inspiration is processed, the LLM (GPT-4o) extracts structured insights:

```typescript
{
  "summary": string,              // 2-3 sentence summary
  "keyTopics": string[],          // 3-7 main topics
  "contentFormat": string,        // "video" | "article" | "thread" | "carousel" | "image" | "infographic" | "story" | "other"
  "tone": string[],               // 2-4 tone attributes (e.g., "professional", "casual", "humorous")
  "targetAudience": string,       // Description of target audience
  "keyInsights": string[],        // 3-5 key takeaways
  "contentStructure": string,     // How content is organized (e.g., "Hook → Story → CTA")
  "visualStyle": string | null,   // Visual style description if applicable
  "suggestedTags": string[]       // 5-10 suggested tags
}
```

---

## Workspace Tags

Tags help organize and categorize content within a workspace. Tags are automatically synced from LLM-extracted suggestions.

### Tag Categories

- `topic` - Subject matter (e.g., "marketing", "AI", "startups")
- `format` - Content format (e.g., "video", "carousel", "thread")
- `tone` - Content tone (e.g., "professional", "casual", "humorous")
- `audience` - Target audience (e.g., "entrepreneurs", "developers")
- `custom` - User-created tags

---

### Get Tags

**Endpoint**: `GET /workspaces/:workspaceId/tags`

**Query Parameters**:
- `category` (optional): Filter by category
- `sortBy` (optional): `name` | `usageCount` | `createdAt` (default: `usageCount`)
- `order` (optional): `asc` | `desc` (default: `desc`)

**Example**: `GET /workspaces/:id/tags?category=topic&sortBy=usageCount&order=desc`

**Response**:
```json
[
  {
    "id": "tag-uuid",
    "workspaceId": "workspace-uuid",
    "name": "startup",
    "category": "topic",
    "color": "#3B82F6",
    "usageCount": 15,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "tag-uuid-2",
    "workspaceId": "workspace-uuid",
    "name": "video",
    "category": "format",
    "color": "#10B981",
    "usageCount": 12,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Create Tag

**Endpoint**: `POST /workspaces/:workspaceId/tags`

**Request**:
```json
{
  "name": "AI",
  "category": "topic",
  "color": "#8B5CF6"
}
```

**Response**: Single tag object (same structure as above)

**Notes**:
- `usageCount` starts at 0
- Tags are case-insensitive (stored as lowercase)

---

### Update Tag

**Endpoint**: `PUT /workspaces/:workspaceId/tags/:id`

**Request** (all fields optional):
```json
{
  "name": "Artificial Intelligence",
  "category": "topic",
  "color": "#6366F1"
}
```

**Response**: Updated tag object

---

### Delete Tag

**Endpoint**: `DELETE /workspaces/:workspaceId/tags/:id`

**Response**: `204 No Content`

---

### Tag Auto-Sync from LLM

When an inspiration is processed:
1. LLM extracts `suggestedTags` array
2. System checks if tags already exist in workspace
3. **If tag exists** → increments `usageCount`
4. **If tag doesn't exist** → creates new tag with `usageCount: 1`
5. Tags are categorized automatically:
   - Content format tags → `category: "format"`
   - Tone tags → `category: "tone"`
   - Others → `category: "topic"` (default)

---

## Data Types

### WorkspaceDto
```typescript
{
  id: string
  userId: string
  name: string
  description: string | null
  avatarUrl: string | null
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}
```

### MainPrompt
```typescript
{
  brandVoice: string
  coreThemes: string[]
  targetAudience: string
  contentGoals: string[]
  avoidTopics: string[]
  preferredFormats: string[]
  additionalContext: string
}
```

### Inspiration
```typescript
{
  id: string
  workspaceId: string
  userId: string
  type: 'text' | 'url' | 'image' | 'video' | 'document'
  content: string
  imageUrl: string | null
  userDescription: string | null
  metadata: {
    title?: string
    description?: string
    imageUrl?: string
    siteName?: string
    author?: string
    publishedDate?: string
    videoThumbnail?: string
    videoDuration?: number
    fileName?: string
    fileSize?: number
    mimeType?: string
  } | null
  parsedContent: {
    textContent: string
    wordCount: number
  } | null
  status: 'processing' | 'completed' | 'failed'
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
  extraction?: ExtractionData | null
}
```

### ExtractionData
```typescript
{
  summary: string
  keyTopics: string[]
  contentFormat: 'video' | 'article' | 'thread' | 'carousel' | 'image' | 'infographic' | 'story' | 'other'
  tone: string[]
  targetAudience: string
  keyInsights: string[]
  contentStructure: string
  visualStyle: string | null
  suggestedTags: string[]
}
```

### WorkspaceTag
```typescript
{
  id: string
  workspaceId: string
  name: string
  category: 'topic' | 'format' | 'tone' | 'audience' | 'custom'
  color: string
  usageCount: number
  createdAt: Date
  updatedAt: Date
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Successful GET/PUT request
- `201 Created` - Successful POST request
- `204 No Content` - Successful DELETE request
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - User doesn't have access to resource
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input data
- `NOT_FOUND` - Resource not found
- `FORBIDDEN` - Access denied
- `UNAUTHORIZED` - Authentication required
- `DUPLICATE_ERROR` - Resource already exists
- `LLM_EXTRACTION_FAILED` - AI processing failed
- `CONTENT_PARSING_FAILED` - Content extraction failed
- `UNKNOWN_ERROR` - Unexpected error

---

## UI/UX Recommendations

### Onboarding Flow

1. **User signs up** → No workspace created
2. **Show onboarding modal**:
   - "Create your first workspace"
   - Explain what workspaces are
   - Form: name + description
3. **First workspace created** → Automatically default
4. **Guide user to add first inspiration**

### Workspace Management

- Show default workspace badge/star icon
- Allow switching default with confirmation modal
- Display workspace selector in header/sidebar
- Show inspiration count per workspace

### Inspirations

**List View**:
- Show status indicator (processing/completed/failed)
- Display type icon (text/url/image/video/document)
- Show preview (image thumbnail, URL favicon, document icon)
- Show truncated description
- Add filter by status/type
- Add search by content/description

**Detail View**:
- Show full content and metadata
- Display LLM extraction results in organized sections
- Show suggested tags with ability to add to workspace
- Allow editing description
- Show processing status/error message

**Processing States**:
- Show loading spinner for `processing` status
- Poll for updates every 5-10 seconds
- Show success notification on completion
- Show error message on failure with retry option

### Tags

- Display as colored chips/badges
- Group by category in tag selector
- Show usage count on hover
- Sort by usage count by default
- Allow creating custom tags
- Auto-suggest tags from LLM extraction

### Main Prompt

- Show as a collapsible section in workspace settings
- Use form with helpful placeholders
- Show examples for each field
- Indicate optional fields
- Save automatically or with explicit save button

---

## Rate Limits & Quotas

### Per User Limits (MVP)

- **Workspaces**: Unlimited
- **Inspirations**: Unlimited (subject to storage limits)
- **Tags**: Unlimited per workspace
- **API Requests**: 1000 requests/hour

### Processing Limits

- **LLM Token Limit**: ~1500 tokens per extraction
- **Document Size**: Max 10 MB
- **Video Processing**: Via oEmbed (no direct video upload)
- **Image Upload**: Max 5 MB

---

## Next Steps for Frontend

### Phase 1: Core Setup
- [ ] Implement authentication flow
- [ ] Create workspace management UI
- [ ] Build workspace selector component

### Phase 2: Inspirations
- [ ] Create inspiration form (all types)
- [ ] Build inspiration list view
- [ ] Implement inspiration detail view
- [ ] Add status polling for processing inspirations

### Phase 3: Tags & AI
- [ ] Display LLM extraction results
- [ ] Build tag management UI
- [ ] Implement tag filtering/search
- [ ] Show suggested tags from LLM

### Phase 4: Polish
- [ ] Add main prompt configuration
- [ ] Implement error handling & retry logic
- [ ] Add loading states & optimistic updates
- [ ] Create onboarding flow

---

## Support & Questions

For questions or issues, please refer to:
- Backend repository: [Link to repo]
- API documentation: This file
- Technical documentation: `/docs` folder in backend repo

---

**Last Updated**: January 2, 2025

