# Frontend Integration - Quick Reference Guide

## API Endpoint

```
GET /api/media/images
Authorization: Bearer {token}
```

## Quick Start

### 1. TypeScript Types

```typescript
interface ListUserImagesParams {
  limit?: number;        // 1-100, default: 50
  cursor?: string;       // pagination token
  prefix?: string;       // e.g., "covers/", "accounts/"
  signed?: boolean;      // default: false
  expiresIn?: number;    // 60-86400, default: 3600
}

interface MediaItem {
  key: string;
  url: string;
  signedUrl?: string;
  size: number;
  lastModified: string;
}

interface ListUserImagesResponse {
  items: MediaItem[];
  nextCursor?: string;
  hasMore: boolean;
}
```

### 2. API Service

```typescript
export const mediaService = {
  async listUserImages(params: ListUserImagesParams = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.cursor) query.append('cursor', params.cursor);
    if (params.prefix) query.append('prefix', params.prefix);
    if (params.signed) query.append('signed', params.signed.toString());
    if (params.expiresIn) query.append('expiresIn', params.expiresIn.toString());

    const response = await apiClient.get(`/api/media/images?${query}`);
    return response.data;
  }
};
```

### 3. React Hook (with React Query)

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

export function useUserImages(params = {}) {
  return useInfiniteQuery({
    queryKey: ['user-images', params],
    queryFn: ({ pageParam }) =>
      mediaService.listUserImages({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}
```

### 4. Basic Usage

```typescript
function ImageGallery() {
  const { data, fetchNextPage, hasNextPage, isLoading } = useUserImages({
    limit: 24,
    signed: true,
  });

  const allImages = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <div>
      <div className="grid grid-cols-4 gap-4">
        {allImages.map(img => (
          <img key={img.key} src={img.signedUrl || img.url} />
        ))}
      </div>
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Load More</button>
      )}
    </div>
  );
}
```

## Common Use Cases

### Filter by Folder
```typescript
// Show only cover images
useUserImages({ prefix: 'covers/' })

// Show only account avatars
useUserImages({ prefix: 'accounts/' })
```

### With Signed URLs
```typescript
// 1 hour expiration
useUserImages({ signed: true, expiresIn: 3600 })

// 12 hour expiration
useUserImages({ signed: true, expiresIn: 43200 })
```

### Custom Pagination
```typescript
// Show 50 items per page
useUserImages({ limit: 50 })
```

## Error Handling

```typescript
const { error, isError } = useUserImages();

if (isError) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 500) {
    // Show error message + retry button
  }
}
```

## Testing on Staging

```bash
# Base URL
https://staging-api.zapshipr.com/api/media/images

# Example with curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://staging-api.zapshipr.com/api/media/images?limit=10&signed=true"
```

## Key Points

✅ **Authentication Required** - Always send Bearer token
✅ **Auto User-Scoped** - Backend automatically filters to current user's images
✅ **Image Files Only** - Non-image files are automatically filtered out
✅ **Use Signed URLs** - For private/secure images, set `signed=true`
✅ **Pagination** - Use `nextCursor` from response for next page
✅ **Cache Friendly** - Recommended stale time: 5 minutes

## Need Help?

📚 Full docs: `/docs/frontend-integration-task.xml`
📖 Backend README: `/src/modules/media/README.md`
💬 Questions: #frontend-backend Slack channel
