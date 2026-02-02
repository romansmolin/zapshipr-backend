# Media Module

This module provides endpoints for managing and retrieving user media assets stored in S3.

## Endpoints

### GET /api/media/images

List all images stored in S3 for the authenticated user.

#### Authentication

**Required**: Yes (Bearer token or cookie)

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 50 | Maximum number of items to return (1-100) |
| `cursor` | string | No | - | Pagination cursor from previous response |
| `prefix` | string | No | - | Optional sub-prefix under user folder (e.g., "covers/", "accounts/") |
| `signed` | boolean | No | false | Generate signed URLs for secure access |
| `expiresIn` | number | No | 3600 | Signed URL expiration in seconds (60-86400, only used when signed=true) |

#### Response

```json
{
  "items": [
    {
      "key": "user-123/covers/1234567890-image.jpg",
      "url": "https://bucket.s3.amazonaws.com/user-123/covers/1234567890-image.jpg",
      "signedUrl": "https://bucket.s3.amazonaws.com/user-123/covers/1234567890-image.jpg?X-Amz-Algorithm=...",
      "size": 102400,
      "lastModified": "2024-01-01T12:00:00.000Z"
    }
  ],
  "nextCursor": "continuation-token",
  "hasMore": true
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `items` | array | Array of image objects |
| `items[].key` | string | S3 object key |
| `items[].url` | string | Public S3 URL |
| `items[].signedUrl` | string | Presigned URL (only present when signed=true) |
| `items[].size` | number | File size in bytes |
| `items[].lastModified` | string | ISO 8601 timestamp of last modification |
| `nextCursor` | string | Token for fetching next page (only present when hasMore=true) |
| `hasMore` | boolean | Whether more results are available |

#### Example Requests

**List all user images (default)**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api/media/images"
```

**List with pagination**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api/media/images?limit=25&cursor=<cursor-token>"
```

**List images in specific folder**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api/media/images?prefix=covers/"
```

**List with signed URLs (2 hour expiration)**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://api.example.com/api/media/images?signed=true&expiresIn=7200"
```

#### Error Responses

**401 Unauthorized**
```json
{
  "errorMessageCode": "UNAUTHORIZED",
  "httpCode": 401
}
```

**400 Bad Request** (validation error)
```json
{
  "errorMessageCode": "BAD_REQUEST",
  "httpCode": 400,
  "fields": [
    {
      "field": "limit",
      "message": "Number must be less than or equal to 100"
    }
  ]
}
```

**500 Internal Server Error**
```json
{
  "errorMessageCode": "UNKNOWN_ERROR",
  "httpCode": 500
}
```

## Architecture

### Module Structure

```
media/
├── controllers/
│   ├── media-controller.interface.ts
│   └── media.controller.ts
├── services/
│   ├── media-service.interface.ts
│   ├── media.service.ts
│   └── media.service.test.ts
├── routes/
│   └── media.routes.ts
├── validation/
│   └── media.schemas.ts
├── entity/
│   └── media.dto.ts
└── README.md
```

### Dependencies

- **S3Uploader**: Extended with `listObjects()` and `getSignedUrl()` methods
- **AuthMiddleware**: Validates JWT and attaches `req.user.id`
- **Zod**: Request validation
- **@aws-sdk/client-s3**: S3 operations
- **@aws-sdk/s3-request-presigner**: Signed URL generation

### S3 Key Structure

The endpoint follows the existing S3 key structure used throughout the application:

```
{userId}/{category}/{timestamp}-{filename}
```

Examples:
- `user-123/covers/1234567890-header.jpg`
- `user-123/accounts/1234567890-avatar.png`
- `user-456/inspirations/1234567890-idea.jpg`

### Image Filtering

The service automatically filters results to include only common image formats:
- `.jpg`, `.jpeg`
- `.png`
- `.gif`
- `.webp`
- `.svg`
- `.bmp`
- `.ico`

Non-image files are excluded from the results.

## Testing

Run unit tests:

```bash
npm test -- src/modules/media/services/media.service.test.ts
```

Test coverage includes:
- Default listing with user-scoped prefix
- Custom prefix handling
- Image extension filtering
- Pagination with continuation tokens
- Signed URL generation
- Limit constraints
- Error handling

## Configuration

Required environment variables:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```

## Security Considerations

1. **User Scoping**: All queries are automatically scoped to the authenticated user's folder (`{userId}/`)
2. **Signed URLs**: Use `signed=true` for temporary, secure access to private objects
3. **Rate Limiting**: Consider adding rate limiting for production use
4. **Bucket Policies**: Ensure S3 bucket has appropriate IAM policies for listing and reading objects
5. **CORS**: Configure S3 bucket CORS if accessing images from browser

## Future Enhancements

Potential improvements for future iterations:

- [ ] Add sorting options (by date, size, name)
- [ ] Support filtering by date range
- [ ] Add metadata filtering (content type, custom tags)
- [ ] Implement caching layer for frequently accessed listings
- [ ] Add support for other media types (videos, documents)
- [ ] Implement bulk operations (delete, move)
- [ ] Add thumbnail generation and serving
- [ ] Support for CloudFront CDN integration
