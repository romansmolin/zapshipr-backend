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

**Base URL**: `http://localhost:4000/api/v1`

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

## Integration Requirements: Inspirations System

This section provides detailed technical requirements for successfully integrating the Inspirations System into the frontend application.

---

### 1. File Upload Requirements

#### Image Upload (for Image Inspirations)

**Endpoint**: Your file upload endpoint (e.g., `/upload/image`)

**Requirements**:
- Max file size: 5 MB
- Supported formats: JPEG, PNG, GIF, WebP
- Upload to S3 before creating inspiration
- Use returned S3 URL as `imageUrl` in POST request

**Flow**:
```javascript
// 1. Upload image to S3
const formData = new FormData()
formData.append('file', imageFile)

const uploadResponse = await fetch('/api/v1/upload/image', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
})

const { url: imageUrl } = await uploadResponse.json()

// 2. Create inspiration with S3 URL
const inspiration = await fetch('/api/v1/workspaces/:workspaceId/inspirations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'image',
    imageUrl: imageUrl,
    userDescription: 'Great color scheme'
  })
})
```

#### Document Upload (for Document Inspirations)

**Requirements**:
- Max file size: 10 MB
- Supported formats: PDF, DOCX, TXT, MD
- Upload to S3 before creating inspiration
- Use returned S3 URL as `content` in POST request

**Flow**: Similar to image upload, but set `type: 'document'` and use URL in `content` field

---

### 2. Status Polling & Real-time Updates

#### Polling Strategy

When an inspiration is created, it starts with `status: "processing"`. The frontend must poll for updates until processing completes.

**Implementation**:

```javascript
async function createAndTrackInspiration(data) {
  // 1. Create inspiration
  const response = await createInspiration(data)
  const inspiration = await response.json()
  
  // 2. If status is 'processing', start polling
  if (inspiration.status === 'processing') {
    return await pollInspirationStatus(inspiration.id, inspiration.workspaceId)
  }
  
  return inspiration
}

async function pollInspirationStatus(inspirationId, workspaceId, maxAttempts = 60) {
  let attempts = 0
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
    
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/inspirations/${inspirationId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    const inspiration = await response.json()
    
    // Check if processing completed
    if (inspiration.status === 'completed') {
      return inspiration
    }
    
    if (inspiration.status === 'failed') {
      throw new Error(inspiration.errorMessage || 'Processing failed')
    }
    
    attempts++
  }
  
  throw new Error('Processing timeout - please refresh to check status')
}
```

**Polling Configuration**:
- Interval: 5 seconds
- Max attempts: 60 (5 minutes total)
- Timeout behavior: Show message to user, stop polling

**UI Indicators**:
- Show loading spinner during processing
- Update inspiration in list when completed
- Show success toast notification
- Show error message if failed

---

### 3. Inspiration Type Validation

#### Text Inspiration
```typescript
{
  type: 'text',
  content: string,        // Required, min: 10 chars, max: 10000 chars
  userDescription?: string // Optional, max: 500 chars
}
```

#### URL Inspiration
```typescript
{
  type: 'url',
  content: string,        // Required, must be valid URL
  userDescription?: string // Optional, max: 500 chars
}
```

**Frontend Validation**:
- Validate URL format: `https?://...`
- Check if URL is accessible (optional pre-validation)
- Show preview of URL metadata if available

#### Image Inspiration
```typescript
{
  type: 'image',
  imageUrl: string,       // Required, must be S3 URL
  userDescription?: string // Optional, max: 500 chars
}
```

**Frontend Requirements**:
- Show image preview after upload
- Display upload progress
- Validate file size before upload
- Handle upload errors gracefully

#### Video Inspiration
```typescript
{
  type: 'video',
  content: string,        // Required, must be valid video URL
  userDescription?: string // Optional, max: 500 chars
}
```

**Supported Platforms**:
- YouTube: `youtube.com/watch?v=...` or `youtu.be/...`
- Vimeo: `vimeo.com/...`
- TikTok: `tiktok.com/@.../video/...`

**Frontend Validation**:
- Validate video URL format
- Show video thumbnail if available (use oEmbed API)
- Extract video metadata for preview

#### Document Inspiration
```typescript
{
  type: 'document',
  content: string,        // Required, must be S3 URL to document
  userDescription?: string // Optional, max: 500 chars
}
```

**Frontend Requirements**:
- Show document upload progress
- Display file name and size
- Show appropriate icon for file type (PDF, DOCX, etc.)
- Handle upload errors with clear messages

---

### 4. Error Handling

#### Common Error Scenarios

**1. Invalid URL**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid URL format"
  }
}
```
**UI Action**: Show inline error under URL input field

**2. Duplicate URL**
```json
{
  "error": {
    "code": "DUPLICATE_ERROR",
    "message": "This URL has already been saved in this workspace"
  }
}
```
**UI Action**: Show modal asking if user wants to view existing inspiration

**3. Processing Failed**
```json
{
  "status": "failed",
  "errorMessage": "Failed to extract content from URL"
}
```
**UI Actions**:
- Show error badge on inspiration card
- Display error message in detail view
- Provide "Retry" button
- Allow user to edit and re-submit

**4. File Upload Failed**
```json
{
  "error": {
    "code": "UPLOAD_FAILED",
    "message": "File size exceeds maximum allowed size"
  }
}
```
**UI Action**: Show error toast with clear message about size/format requirements

**5. LLM Extraction Failed**
```json
{
  "status": "failed",
  "errorMessage": "AI analysis failed - content may be too long or in unsupported format"
}
```
**UI Actions**:
- Inspiration still saved (user can view original content)
- Show warning that AI insights are unavailable
- Suggest manual tag addition
- Don't block user from using the inspiration

---

### 5. Displaying Extraction Results

#### Extraction Data Layout

**Summary Section**:
```jsx
<section>
  <h3>Summary</h3>
  <p>{extraction.summary}</p>
</section>
```

**Key Topics**:
```jsx
<section>
  <h3>Key Topics</h3>
  <div className="flex flex-wrap gap-2">
    {extraction.keyTopics.map(topic => (
      <Badge key={topic} color="blue">{topic}</Badge>
    ))}
  </div>
</section>
```

**Content Analysis**:
```jsx
<section>
  <h3>Content Analysis</h3>
  <dl>
    <dt>Format:</dt>
    <dd>{extraction.contentFormat}</dd>
    
    <dt>Tone:</dt>
    <dd>{extraction.tone.join(', ')}</dd>
    
    <dt>Target Audience:</dt>
    <dd>{extraction.targetAudience}</dd>
    
    <dt>Structure:</dt>
    <dd>{extraction.contentStructure}</dd>
    
    {extraction.visualStyle && (
      <>
        <dt>Visual Style:</dt>
        <dd>{extraction.visualStyle}</dd>
      </>
    )}
  </dl>
</section>
```

**Key Insights**:
```jsx
<section>
  <h3>Key Insights</h3>
  <ul>
    {extraction.keyInsights.map((insight, i) => (
      <li key={i}>{insight}</li>
    ))}
  </ul>
</section>
```

**Suggested Tags**:
```jsx
<section>
  <h3>Suggested Tags</h3>
  <div className="flex flex-wrap gap-2">
    {extraction.suggestedTags.map(tag => (
      <Badge 
        key={tag} 
        color="purple"
        onClick={() => addTagToWorkspace(tag)}
      >
        {tag}
        <PlusIcon className="ml-1 h-3 w-3" />
      </Badge>
    ))}
  </div>
</section>
```

---

### 6. List View Requirements

#### Inspiration Card Component

**Required Elements**:
- Type indicator icon (text/url/image/video/document)
- Status badge (processing/completed/failed)
- Preview (thumbnail for images/videos, favicon for URLs)
- User description (truncated to 100 chars)
- Created date (relative: "2 hours ago")
- Action menu (view, edit, delete)

**Visual States**:

**Processing**:
```jsx
<Card className="opacity-75">
  <LoadingSpinner />
  <p>Processing content...</p>
</Card>
```

**Completed**:
```jsx
<Card>
  <TypeIcon type={inspiration.type} />
  {inspiration.imageUrl && <img src={inspiration.imageUrl} />}
  <p>{truncate(inspiration.userDescription, 100)}</p>
  <Badge color="green">Completed</Badge>
  {inspiration.extraction && (
    <div className="tags">
      {inspiration.extraction.keyTopics.slice(0, 3).map(topic => (
        <SmallBadge key={topic}>{topic}</SmallBadge>
      ))}
    </div>
  )}
</Card>
```

**Failed**:
```jsx
<Card className="border-red-200">
  <TypeIcon type={inspiration.type} />
  <p>{truncate(inspiration.userDescription, 100)}</p>
  <Badge color="red">Failed</Badge>
  <Button size="sm" onClick={handleRetry}>Retry</Button>
</Card>
```

#### Filters & Search

**Filter Options**:
```jsx
<FilterBar>
  <Select label="Status" value={statusFilter} onChange={setStatusFilter}>
    <option value="">All</option>
    <option value="processing">Processing</option>
    <option value="completed">Completed</option>
    <option value="failed">Failed</option>
  </Select>
  
  <Select label="Type" value={typeFilter} onChange={setTypeFilter}>
    <option value="">All Types</option>
    <option value="text">Text</option>
    <option value="url">URL</option>
    <option value="image">Image</option>
    <option value="video">Video</option>
    <option value="document">Document</option>
  </Select>
  
  <SearchInput 
    placeholder="Search inspirations..." 
    value={searchQuery}
    onChange={setSearchQuery}
  />
</FilterBar>
```

**Pagination**:
```jsx
// Use cursor-based pagination for better performance
const [inspirations, setInspirations] = useState([])
const [hasMore, setHasMore] = useState(true)
const [offset, setOffset] = useState(0)

async function loadMore() {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/inspirations?limit=20&offset=${offset}`,
    { headers: { 'Authorization': `Bearer ${token}` }}
  )
  const newInspirations = await response.json()
  
  setInspirations([...inspirations, ...newInspirations])
  setOffset(offset + 20)
  setHasMore(newInspirations.length === 20)
}
```

---

### 7. Detail View Requirements

#### Layout Structure

```
┌─────────────────────────────────────┐
│ Header: Type Icon + Title          │
│ [Edit] [Delete]                     │
├─────────────────────────────────────┤
│                                     │
│ Content Preview                     │
│ (Image/Video/Text/Document)         │
│                                     │
├─────────────────────────────────────┤
│ User Description (editable)         │
├─────────────────────────────────────┤
│ Metadata (if available)             │
│ - Title, Author, Site Name, etc.    │
├─────────────────────────────────────┤
│ AI Insights (if completed)          │
│ - Summary                           │
│ - Key Topics                        │
│ - Content Analysis                  │
│ - Key Insights                      │
│ - Suggested Tags                    │
├─────────────────────────────────────┤
│ Parsed Content (collapsible)        │
│ - Full text content                 │
│ - Word count                        │
└─────────────────────────────────────┘
```

#### Editable Fields

Only `userDescription` should be editable:

```jsx
const [description, setDescription] = useState(inspiration.userDescription)
const [isEditing, setIsEditing] = useState(false)

async function saveDescription() {
  await fetch(
    `/api/v1/workspaces/${workspaceId}/inspirations/${inspiration.id}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userDescription: description })
    }
  )
  setIsEditing(false)
}
```

---

### 8. Edge Cases & Special Scenarios

#### 1. Very Long Content
- URL with 50,000+ words
- **Backend**: Truncates to first ~5000 words for LLM
- **Frontend**: Show "Content truncated for analysis" warning

#### 2. Content in Non-English Language
- **Backend**: LLM handles multiple languages
- **Frontend**: No special handling needed

#### 3. Protected/Paywalled URLs
- **Backend**: May fail to extract content
- **Frontend**: Show error, suggest using document upload instead

#### 4. Expired Video URLs
- **Backend**: oEmbed may return error
- **Frontend**: Show fallback message with original URL

#### 5. Multiple Inspirations Processing Simultaneously
- **Frontend**: Poll each separately
- **UI**: Show progress count (e.g., "Processing 3 inspirations")

#### 6. User Closes Tab During Processing
- **Backend**: Processing continues in background
- **Frontend**: Resume polling when user returns

#### 7. Network Interruption During Upload
- **Frontend**: Show retry button
- **Backend**: Idempotent operations (safe to retry)

---

### 9. Performance Optimization

#### Lazy Loading Images
```jsx
<img 
  src={inspiration.imageUrl} 
  loading="lazy"
  alt={inspiration.userDescription}
/>
```

#### Virtualized Lists
For workspaces with 100+ inspirations, use virtualization:
```jsx
import { VirtualList } from 'react-virtual'

<VirtualList
  height={600}
  itemCount={inspirations.length}
  itemSize={150}
  renderItem={({ index }) => (
    <InspirationCard inspiration={inspirations[index]} />
  )}
/>
```

#### Optimistic Updates
```jsx
async function deleteInspiration(id) {
  // Optimistically remove from UI
  setInspirations(inspirations.filter(i => i.id !== id))
  
  try {
    await fetch(`/api/v1/workspaces/${workspaceId}/inspirations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
  } catch (error) {
    // Revert on error
    setInspirations([...inspirations])
    showError('Failed to delete inspiration')
  }
}
```

---

### 10. Testing Checklist

- [ ] Create inspiration of each type (text, URL, image, video, document)
- [ ] Verify status polling works and stops when completed
- [ ] Test file upload with max size limit
- [ ] Test invalid URL handling
- [ ] Test duplicate URL detection
- [ ] Test failed processing error display
- [ ] Test editing user description
- [ ] Test deleting inspiration
- [ ] Test filters and search
- [ ] Test pagination with 50+ inspirations
- [ ] Test multiple simultaneous processing
- [ ] Test network interruption during upload
- [ ] Verify extraction results display correctly
- [ ] Test suggested tag addition to workspace
- [ ] Test retry functionality for failed inspirations

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
**API Version**: v1
**Backend Version**: 1.0.0

