# Inspirations System - API Documentation

## Overview

**Inspirations** — система для сохранения и анализа контента из различных источников. Пользователи сохраняют интересный контент, система автоматически извлекает и анализирует его с помощью AI (GPT-4o).

**Base URL**: `http://localhost:4000`

---

## How It Works

```
1. User saves inspiration
   ↓
2. Created with status: "processing"
   ↓
3. Background worker (BullMQ) processes content
   ↓
4. Content Parser extracts text/metadata
   ↓
5. LLM (GPT-4o) analyzes and extracts insights
   ↓
6. Status updated to "completed" or "failed"
   ↓
7. Suggested tags synced to workspace
```

**Processing time**: 5-30 seconds depending on content type

---

## Content Types

| Type       | Description             | Example                   |
| ---------- | ----------------------- | ------------------------- |
| `text`     | Plain text notes        | User's ideas, quotes      |
| `url`      | Web pages, articles     | Blog posts, news articles |
| `image`    | Images with description | Screenshots, infographics |
| `video`    | Video links             | YouTube, Vimeo, TikTok    |
| `document` | Files                   | PDF, DOCX, TXT, MD        |

---

## API Endpoints

### Create Inspiration

**POST** `/workspaces/:workspaceId/inspirations`

**Headers**:

```
Authorization: Bearer {token}
```

#### Text Inspiration

**Request**:

```json
{
    "type": "text",
    "content": "Focus on solving real user problems, not building features",
    "userDescription": "Key principle for product development"
}
```

#### URL Inspiration

**Request**:

```json
{
    "type": "url",
    "content": "https://example.com/article-about-startups",
    "userDescription": "Great article about MVP development"
}
```

#### Image Inspiration

**Request**:

```json
{
    "type": "image",
    "imageUrl": "https://s3.amazonaws.com/.../image.jpg",
    "userDescription": "Perfect color palette for our brand"
}
```

#### Video Inspiration

**Request**:

```json
{
    "type": "video",
    "content": "https://youtube.com/watch?v=abc123",
    "userDescription": "Tutorial on Instagram Reels editing"
}
```

#### Document Inspiration

**Request**:

```json
{
    "type": "document",
    "content": "https://s3.amazonaws.com/.../report.pdf",
    "userDescription": "Industry trends report 2024"
}
```

**Response** (all types):

```json
{
    "id": "insp_abc123",
    "workspaceId": "ws_xyz789",
    "userId": "user_456",
    "type": "url",
    "content": "https://example.com/article",
    "imageUrl": null,
    "userDescription": "Great article",
    "metadata": null,
    "parsedContent": null,
    "status": "processing",
    "errorMessage": null,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
}
```

---

### Get Inspirations

**GET** `/workspaces/:workspaceId/inspirations`

**Query Parameters**:

- `status` (optional): `processing` | `completed` | `failed`
- `type` (optional): `text` | `url` | `image` | `video` | `document`
- `limit` (optional): 1-100, default: 20
- `offset` (optional): pagination offset, default: 0

**Example**:

```
GET /workspaces/ws_xyz/inspirations?status=completed&type=url&limit=10
```

**Response**:

```json
[
    {
        "id": "insp_abc123",
        "workspaceId": "ws_xyz789",
        "userId": "user_456",
        "type": "url",
        "content": "https://example.com/article",
        "imageUrl": null,
        "userDescription": "Great article about startups",
        "metadata": {
            "title": "How to Build a Successful Startup",
            "description": "Complete guide to building a startup...",
            "imageUrl": "https://example.com/og-image.jpg",
            "siteName": "TechCrunch",
            "author": "John Doe"
        },
        "parsedContent": {
            "textContent": "Full article text extracted...",
            "wordCount": 1500
        },
        "status": "completed",
        "errorMessage": null,
        "createdAt": "2024-01-01T12:00:00Z",
        "updatedAt": "2024-01-01T12:05:00Z",
        "extraction": {
            "summary": "This article covers the fundamentals of building a startup, from finding product-market fit to securing funding.",
            "keyTopics": ["startups", "entrepreneurship", "product-market fit", "fundraising"],
            "contentFormat": "article",
            "tone": ["professional", "educational", "actionable"],
            "targetAudience": "Aspiring entrepreneurs and early-stage founders",
            "keyInsights": [
                "Focus on solving real problems, not building features",
                "Build MVP and validate with real users",
                "Talk to customers before writing any code"
            ],
            "contentStructure": "Hook → Problem → Solution → Case Studies → Actionable Steps → CTA",
            "visualStyle": null,
            "suggestedTags": [
                "startup",
                "entrepreneurship",
                "mvp",
                "product-market-fit",
                "fundraising",
                "business"
            ]
        }
    }
]
```

---

### Get Inspiration by ID

**GET** `/workspaces/:workspaceId/inspirations/:id`

**Response**: Single inspiration object (same structure as above)

---

### Update Inspiration

**PUT** `/workspaces/:workspaceId/inspirations/:id`

**Request** (all fields optional):

```json
{
    "userDescription": "Updated description",
    "content": "Updated content"
}
```

**Response**: Updated inspiration object

**Note**: Cannot update `type`, `status`, `metadata`, `parsedContent` — these are managed by the system

---

### Delete Inspiration

**DELETE** `/workspaces/:workspaceId/inspirations/:id`

**Response**: `204 No Content`

---

## Data Structures

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
  metadata: InspirationMetadata | null
  parsedContent: ParsedContent | null
  status: 'processing' | 'completed' | 'failed'
  errorMessage: string | null
  createdAt: string (ISO 8601)
  updatedAt: string (ISO 8601)
  extraction?: ExtractionData | null
}
```

### InspirationMetadata

```typescript
{
  // For URL/Article
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
  author?: string
  publishedDate?: string

  // For Video
  videoThumbnail?: string
  videoDuration?: number

  // For Document
  fileName?: string
  fileSize?: number
  mimeType?: string
}
```

### ParsedContent

```typescript
{
    textContent: string // Extracted text content
    wordCount: number // Number of words
}
```

### ExtractionData (AI Analysis)

```typescript
{
  summary: string                    // 2-3 sentence summary
  keyTopics: string[]                // 3-7 main topics
  contentFormat: string              // 'video' | 'article' | 'thread' | 'carousel' | 'image' | 'infographic' | 'story' | 'other'
  tone: string[]                     // 2-4 tone attributes (e.g., "professional", "casual", "humorous")
  targetAudience: string             // Description of target audience
  keyInsights: string[]              // 3-5 key takeaways
  contentStructure: string           // How content is organized (e.g., "Hook → Story → CTA")
  visualStyle: string | null         // Visual style description if applicable
  suggestedTags: string[]            // 5-10 suggested tags
}
```

---

## Status Handling

### Processing States

| Status       | Description               | UI Suggestion                         |
| ------------ | ------------------------- | ------------------------------------- |
| `processing` | Content is being analyzed | Show spinner, poll every 5-10 seconds |
| `completed`  | Analysis complete         | Show full data with extraction        |
| `failed`     | Processing failed         | Show error message, offer retry       |

### Polling for Updates

When inspiration is created with `status: "processing"`:

```javascript
async function pollInspiration(workspaceId, inspirationId) {
    const maxAttempts = 30 // 5 minutes (10s * 30)
    let attempts = 0

    const interval = setInterval(async () => {
        attempts++

        const inspiration = await fetch(`/workspaces/${workspaceId}/inspirations/${inspirationId}`)

        if (inspiration.status === 'completed' || inspiration.status === 'failed') {
            clearInterval(interval)
            // Update UI
        }

        if (attempts >= maxAttempts) {
            clearInterval(interval)
            // Show timeout message
        }
    }, 10000) // Poll every 10 seconds
}
```

---

## Error Handling

### Error Response Format

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid request data",
        "details": [
            {
                "field": "type",
                "message": "type must be one of: text, url, image, video, document"
            }
        ]
    }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input data
- `NOT_FOUND` - Inspiration or workspace not found
- `FORBIDDEN` - User doesn't have access
- `CONTENT_PARSING_FAILED` - Failed to extract content
- `LLM_EXTRACTION_FAILED` - AI analysis failed
- `DUPLICATE_URL` - URL already saved (for url type)

---

## UI/UX Recommendations

### List View

**Show for each inspiration**:

- Type icon (text/url/image/video/document)
- Thumbnail (if available)
- Title or truncated content
- User description
- Status indicator
- Created date

**Filters**:

- By status (All / Processing / Completed / Failed)
- By type (All / Text / URL / Image / Video / Document)
- Search by content/description

**Sorting**:

- Newest first (default)
- Oldest first
- By type

### Detail View

**For `status: "processing"`**:

- Show loading spinner
- Display: "Analyzing content..."
- Auto-refresh every 10 seconds

**For `status: "completed"`**:

- Show original content/link
- Display metadata (title, description, author, etc.)
- Show AI extraction in organized sections:
    - Summary (highlighted)
    - Key Topics (as chips/tags)
    - Key Insights (bulleted list)
    - Content Format & Tone
    - Target Audience
    - Content Structure
    - Suggested Tags (clickable to add to workspace)

**For `status: "failed"`**:

- Show error message
- Offer "Retry" button
- Still show user description and original content

### Create Form

**Type Selector**:

```
[Text] [URL] [Image] [Video] [Document]
```

**Form Fields** (adapt based on type):

- Text: Textarea for content
- URL: Input field + preview after validation
- Image: Upload button or URL input
- Video: URL input with platform icons
- Document: File upload (max 10MB)
- User Description: Optional textarea for all types

**Validation**:

- Required: `type`, `content` or `imageUrl`
- URL format validation for url/video types
- File size limit for documents (10MB)

### Suggested Tags

After processing completes:

- Display `suggestedTags` as chips
- Add "+" button to add tag to workspace
- Show checkmark if tag already exists
- Update tag usage count on click

---

## Technical Notes

### Content Processing

**Text**: No parsing needed, sent directly to LLM

**URL**:

- Fetches page with axios
- Extracts metadata (Open Graph, Twitter Cards)
- Parses HTML with cheerio
- Sends cleaned text to LLM

**Image**: User description + OCR (future feature)

**Video**:

- Fetches metadata via oEmbed
- Extracts thumbnail, duration, title
- Sends metadata to LLM

**Document**:

- PDF: Extracts text with pdf-parse
- DOCX: Extracts text with mammoth
- TXT/MD: Reads directly
- Sends extracted text to LLM

### LLM Settings

- Model: `gpt-4o`
- Max tokens: 1500
- Temperature: 0.7
- Output: JSON Schema (structured)
- Retry: 3 attempts with exponential backoff

### Rate Limits

- API requests: 1000/hour per user
- LLM processing: ~$0.01-0.03 per inspiration
- Document size: Max 10MB
- Content length: ~10,000 words max

---

## Integration Checklist

### Phase 1: Basic CRUD

- [ ] Create inspiration form (all 5 types)
- [ ] Display inspiration list
- [ ] Show inspiration details
- [ ] Delete inspiration

### Phase 2: Status Handling

- [ ] Show processing state
- [ ] Implement polling for updates
- [ ] Handle failed state with retry

### Phase 3: AI Features

- [ ] Display LLM extraction results
- [ ] Show suggested tags
- [ ] Format key insights and topics

### Phase 4: Polish

- [ ] Add filters (status, type)
- [ ] Add search functionality
- [ ] Implement optimistic updates
- [ ] Add error boundaries

---

**Last Updated**: January 2, 2025
