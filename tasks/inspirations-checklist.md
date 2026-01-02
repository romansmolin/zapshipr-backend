# Inspirations System - Implementation Checklist

## Phase 1: База данных + Raw Inspirations CRUD ✅ (3-4 дня)

### Database & Schema

- [ ] Создать миграцию для `rawInspirations` table
- [ ] Создать миграцию для `inspirationsExtractions` table
- [ ] Создать миграцию для `workspaceTags` table
- [ ] Создать миграцию для добавления `mainPrompt` в `workspaces`
- [ ] Запустить миграции и проверить схему

### Entity Layer

- [ ] `raw-inspiration.schema.ts` (Drizzle schema)
- [ ] `inspirations-extraction.schema.ts` (Drizzle schema)
- [ ] `workspace-tag.schema.ts` (Drizzle schema)
- [ ] Добавить типы в `src/db/schema.ts`

### Repository Layer

- [ ] `inspirations-repository.interface.ts`
- [ ] `inspirations.repository.ts`
    - [ ] `create()`
    - [ ] `findById()`
    - [ ] `findByWorkspaceId()`
    - [ ] `update()`
    - [ ] `delete()`
    - [ ] `checkDuplicateUrl()`
- [ ] `workspace-tags-repository.interface.ts`
- [ ] `workspace-tags.repository.ts`

### Validation Layer

- [ ] `inspirations.schemas.ts` (Zod schemas)
    - [ ] CreateInspirationSchema
    - [ ] UpdateInspirationSchema
    - [ ] GetInspirationsQuerySchema
    - [ ] CreateTagSchema
    - [ ] UpdateMainPromptSchema

### Service Layer

- [ ] `inspirations-service.interface.ts`
- [ ] `inspirations.service.ts`
    - [ ] `createInspiration()` — с загрузкой в S3
    - [ ] `getInspirations()` — с фильтрацией
    - [ ] `getInspirationById()`
    - [ ] `updateInspiration()`
    - [ ] `deleteInspiration()`
    - [ ] `checkDuplicate()`

### Controller Layer

- [ ] `inspirations.controller.ts`
    - [ ] POST `/workspaces/:id/inspirations`
    - [ ] GET `/workspaces/:id/inspirations`
    - [ ] GET `/inspirations/:id`
    - [ ] PUT `/inspirations/:id`
    - [ ] DELETE `/inspirations/:id`

### Routes

- [ ] `inspirations.routes.ts`
- [ ] Интегрировать в `app.ts`

### Testing Phase 1

- [ ] Создание inspiration (type=text)
- [ ] Создание inspiration (type=link) с проверкой дубликатов
- [ ] Создание inspiration (type=image) с загрузкой в S3
- [ ] Создание inspiration (type=document) с загрузкой файла
- [ ] Получение списка inspirations
- [ ] Получение деталей inspiration
- [ ] Обновление userDescription
- [ ] Удаление inspiration

---

## Phase 2: Content Parsing + LLM Integration 🔄 (5-7 дней)

### Dependencies

- [ ] Установить `cheerio` (парсинг HTML)
- [ ] Установить `pdf-parse` (парсинг PDF)
- [ ] Установить `mammoth` (парсинг DOCX)
- [ ] Установить `openai` (если еще нет)
- [ ] Установить `file-type` (проверка MIME types)

### Content Parser Service

- [ ] `content-parser-service.interface.ts`
- [ ] `content-parser.service.ts`
    - [ ] `parseUrl()` — парсинг веб-страниц (cheerio)
    - [ ] `parseDocument()` — парсинг PDF/DOCX
    - [ ] `extractVideoMetadata()` — YouTube/Vimeo metadata
    - [ ] `normalizeContent()` — лимит 1500 слов
    - [ ] Error handling & timeouts (30s)

### LLM Extraction Service

- [ ] `llm-extraction-service.interface.ts`
- [ ] `llm-extraction.service.ts`
    - [ ] `createExtraction()` — вызов OpenAI API
    - [ ] `buildPromptForExtraction()` — построение промпта
    - [ ] Парсинг JSON ответа от OpenAI
    - [ ] Error handling & retry logic

### BullMQ Worker

- [ ] Создать queue: `inspirations:process`
- [ ] `workers/process-inspiration.worker.ts`
    - [ ] Step 1: Получить rawInspiration из БД
    - [ ] Step 2: Парсинг контента (ContentParserService)
    - [ ] Step 3: Сохранить parsedContent в БД
    - [ ] Step 4: Создать extraction (LlmExtractionService)
    - [ ] Step 5: Сохранить extraction в БД
    - [ ] Step 6: Обновить статус на "completed"
    - [ ] Error handling: статус "failed" + errorMessage
    - [ ] Retry strategy: 3 attempts, exponential backoff

### Update InspirationsService

- [ ] После создания inspiration → добавить job в queue
- [ ] Метод `getInspirationById()` — включать extraction в ответ

### Testing Phase 2

- [ ] Парсинг HTML страницы
- [ ] Парсинг YouTube metadata
- [ ] Парсинг PDF документа
- [ ] Парсинг DOCX документа
- [ ] Создание extraction через OpenAI
- [ ] Обработка ошибок парсинга (timeout)
- [ ] Обработка ошибок OpenAI (retry)
- [ ] Проверка нормализации контента (1500 слов)
- [ ] End-to-end: создание inspiration → обработка → extraction

---

## Phase 3: Workspace Tags 🔄 (2-3 дня)

### Service Layer

- [ ] `workspace-tags-service.interface.ts`
- [ ] `workspace-tags.service.ts`
    - [ ] `getTags()` — с фильтрацией и сортировкой
    - [ ] `createTag()` — с проверкой дубликатов
    - [ ] `updateTag()`
    - [ ] `deleteTag()`
    - [ ] `syncTagsFromExtraction()` — создание/обновление тегов

### Tag Categorization Logic

- [ ] Эвристика для определения category из suggestedTags:
    - topic: "marketing", "sales", "growth"
    - format: "video", "carousel", "thread"
    - tone: "professional", "casual", "humorous"
    - style: "minimalist", "bold", "storytelling"
- [ ] Или использовать дополнительный LLM запрос (optional)

### Controller Layer

- [ ] `workspace-tags.controller.ts`
    - [ ] GET `/workspaces/:id/tags`
    - [ ] POST `/workspaces/:id/tags`
    - [ ] PUT `/workspaces/:id/tags/:tagId`
    - [ ] DELETE `/workspaces/:id/tags/:tagId`

### Routes

- [ ] `workspace-tags.routes.ts`
- [ ] Интегрировать в `app.ts`

### Update Worker

- [ ] Добавить шаг синхронизации тегов после создания extraction
- [ ] `WorkspaceTagsService.syncTagsFromExtraction()`

### Testing Phase 3

- [ ] Создание тега вручную
- [ ] Проверка дубликатов тегов
- [ ] Получение тегов с фильтрацией по category
- [ ] Получение тегов с сортировкой по usageCount
- [ ] Автоматическое создание тегов из extraction
- [ ] Обновление usageCount при повторном появлении тега
- [ ] Обновление тега
- [ ] Удаление тега

---

## Phase 4: Main Prompt 🔄 (1-2 дня)

### Update Workspace Service

- [ ] `getMainPrompt()` — получить main prompt для workspace
- [ ] `updateMainPrompt()` — обновить main prompt (partial update)
- [ ] Возвращать пустую структуру если mainPrompt = null

### Update Workspace Controller

- [ ] GET `/workspaces/:id/prompt`
- [ ] PUT `/workspaces/:id/prompt`

### Update Workspace Routes

- [ ] Добавить новые routes
- [ ] Validation для main prompt structure

### Testing Phase 4

- [ ] Получение пустого main prompt
- [ ] Обновление main prompt (полное)
- [ ] Обновление main prompt (partial)
- [ ] Валидация структуры данных
- [ ] Проверка timestamp updatedAt

---

## Security & Validation

### File Upload Security

- [ ] Проверка file extension (whitelist: jpg, png, webp, pdf, txt, md, docx)
- [ ] Проверка MIME type с помощью `file-type`
- [ ] Проверка размера файла (max 50MB)
- [ ] Private access в S3 bucket

### URL Validation & SSRF Protection

- [ ] Проверка валидности URL (Zod)
- [ ] Whitelist протоколов: http, https
- [ ] Блокировка private IP ranges:
    - 127.0.0.0/8 (localhost)
    - 10.0.0.0/8 (private)
    - 172.16.0.0/12 (private)
    - 192.168.0.0/16 (private)
- [ ] Timeout для HTTP requests (30s)

### Authorization

- [ ] Все endpoints проверяют JWT auth
- [ ] Проверка ownership workspace
- [ ] Проверка ownership inspiration при update/delete

---

## Documentation

- [ ] Обновить `docs/03-modules.md` — добавить Inspiration Module
- [ ] Обновить `docs/04-database.md` — добавить новые таблицы
- [ ] Обновить `docs/05-queues-workers.md` — добавить worker

---

## Future Enhancements (Post-MVP)

### Phase 5: Integration with Post Generation

- [ ] Получать inspirations при генерации постов
- [ ] Включать main prompt в контекст LLM
- [ ] Включать workspace tags в контекст
- [ ] Построение расширенного промпта

### Additional Features

- [ ] Bulk import inspirations
- [ ] Re-processing при обновлении userDescription
- [ ] Автообновление main prompt на основе extractions
- [ ] Архивация старых inspirations (> 6 месяцев)
- [ ] Rate limiting (50 inspirations/hour per workspace)
- [ ] Metrics & monitoring (OpenAI tokens, cost tracking)

---

## Notes & Decisions

**Дубликаты:** Блокировать только для type=link (unique constraint на URL)

**Парсинг:** Timeout 30s, fallback если парсинг не удался (сохранить только URL/filename)

**LLM Model:** OpenAI GPT-4o (или gpt-4o-mini для экономии)

**Content Limit:** 1500 слов для parsedContent

**Background Processing:** Использовать BullMQ для асинхронной обработки

**Tag Categorization:** Эвристика на основе ключевых слов (без дополнительного LLM вызова)

---

**Total Estimated Time: 2-3 weeks**

**Priority:** High (MVP feature for ZapShipr)
