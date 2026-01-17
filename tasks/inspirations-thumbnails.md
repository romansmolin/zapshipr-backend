# Inspirations thumbnails for PDF / MD / TXT

When triggering the `create` method in `@inspirations.controller.ts`, we need to generate and set a thumbnail not only for YouTube videos, but also for document-based inspirations:

* `pdf`
* `txt`
* `markdown`

The existing inspiration creation logic already works correctly.
This task focuses **only on adding thumbnail generation for documents** and saving generated thumbnails to the S3 bucket.

---

## Scope

* Supported formats (MVP): **PDF, TXT, Markdown**
* Thumbnail generation happens during inspiration creation
* Generated thumbnails are uploaded to S3
* Thumbnail reference is attached to the inspiration entity

---

## Implementation requirements

### Utilities (no new classes)

There is **no need to introduce new services or classes**.

Add the following utility functions:

* `getThumbnailFromPdf`
* `getThumbnailFromMarkdown`
* `getThumbnailFromTxt`

Each utility should:

* Accept document content (buffer or string) and minimal required metadata
* Generate a preview thumbnail image
* Return a result suitable for S3 upload (e.g. image buffer + metadata)

---

## Thumbnail behavior

### PDF

* Generate thumbnail from **first page only**
* Output image format: `webp` (preferred) or `png`
* Preserve aspect ratio
* Reasonable preview size (e.g. ~512px max dimension)

### Markdown / TXT

* Generate a **text-based preview thumbnail**
* Use the first meaningful part of the content (e.g. first N lines or characters)
* Render text in a readable, page-like layout
* Markdown can be treated as plain text (basic token stripping is acceptable for MVP)

---

## Integration

* Call the appropriate utility inside the `create` flow of `inspirations.controller.ts`
* Upload the generated thumbnail to S3 using existing infrastructure
* Save the thumbnail reference (URL or key) on the inspiration record

---

## Testing

Add **unit tests** for the utilities:

* `getThumbnailFromPdf`
* `getThumbnailFromMarkdown`
* `getThumbnailFromTxt`

Each test should verify:

* A thumbnail is generated for valid input
* Output format and dimensions are correct
* Function behaves predictably with minimal input

---

## Result

After implementation:

* PDF, Markdown, and TXT inspirations have thumbnails
* Thumbnails are stored in S3
* Frontend receives a usable thumbnail reference
* Existing inspiration business logic remains unchanged
