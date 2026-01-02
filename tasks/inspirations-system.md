# Техническое задание: Система вдохновений (Inspirations System)

## 1. Обзор

ZapShipr трансформируется из простого планировщика постов в обучаемую систему, которая накапливает знания о стиле, предпочтениях и вдохновениях пользователя для каждого workspace.

### Ключевые компоненты:

1. **Raw Inspirations** — исходные данные от пользователя (ссылки, изображения, текст, документы)
2. **Inspirations Extractions** — машинно-обработанная структура для AI
3. **Workspace Tags** — агрегированные темы и паттерны workspace
4. **Main Prompt** — базовый контекст workspace для работы AI

---

## 2. User Workflow

```
User добавляет Raw Inspiration
  ↓
  ├─ Изображение (загружается в S3)
  ├─ Документ (PDF, TXT, MD, DOCX - парсится контент)
  ├─ Ссылка на видео (YouTube, Vimeo - извлекается metadata)
  ├─ Ссылка на статью (парсится контент)
  └─ Текст (сохраняется как есть)
  ↓
User добавляет описание (optional): "Мне нравится tone of voice в этом примере"
  ↓
Система сохраняет Raw Inspiration (status: processing)
  ↓
Background Job (BullMQ):
  ├─ Парсинг/загрузка контента (если нужно)
  ├─ Отправка в OpenAI API
  ├─ Создание Inspirations Extraction
  ├─ Обновление Workspace Tags (merge с существующими)
  └─ Обновление статуса (status: completed)
```

---

## 3. Структура базы данных

### 3.1 Таблица `rawInspirations`

```typescript
{
  id: uuid (PK),
  workspaceId: uuid (FK → workspaces.id, cascade delete),
  userId: uuid (FK → users.id, cascade delete),

  // Тип вдохновения
  type: enum('image', 'link', 'text', 'document'),

  // Данные вдохновения
  content: text,              // Текст или URL
  imageUrl: varchar(1024),    // Ссылка на изображение в S3 (если type=image)
  userDescription: text,      // Описание от пользователя (optional)

  // Метаданные (parsed)
  metadata: jsonb,            // {title, description, author, domain, etc}
  parsedContent: text,        // Извлеченный текст (max 1500 слов)

  // Статус обработки
  status: enum('processing', 'completed', 'failed'),
  errorMessage: text,         // Если status=failed

  createdAt: timestamp,
  updatedAt: timestamp,
}
```

**Индексы:**

- `(workspaceId, createdAt DESC)` — для списка вдохновений
- `(workspaceId, type)` — для фильтрации по типу
- `(workspaceId, status)` — для поиска processing/failed

**Уникальность (дубликаты):**

- Для `type=link`: unique constraint на `(workspaceId, content)` где content это нормализованный URL
- Для остальных типов: без constraint (изображения и тексты могут повторяться)

---

### 3.2 Таблица `inspirationsExtractions`

```typescript
{
  id: uuid (PK),
  rawInspirationId: uuid (FK → rawInspirations.id, cascade delete),
  workspaceId: uuid (FK → workspaces.id, cascade delete),

  // Структура для LLM (оптимизирована для AI)
  summary: text,                    // Краткое описание (2-3 предложения)
  keyTopics: text[],                // ["marketing", "storytelling", "sales"]
  contentFormat: varchar(50),       // "video", "article", "thread", "carousel", "image"
  tone: text[],                     // ["professional", "casual", "humorous"]
  targetAudience: text,             // "B2B marketers", "entrepreneurs", "creators"
  keyInsights: text[],              // Ключевые идеи/takeaways
  contentStructure: text,           // Описание структуры (hook, body, cta)
  visualStyle: text,                // Визуальный стиль (если есть)
  suggestedTags: text[],            // Предложенные теги для workspace

  // Мета
  llmModel: varchar(50),            // Модель OpenAI, использованная для обработки
  tokensUsed: integer,              // Количество токенов

  createdAt: timestamp,
}
```

**Индексы:**

- `(workspaceId, createdAt DESC)` — для выборки последних extractions
- `(rawInspirationId)` — для связи с raw inspiration

---

### 3.3 Таблица `workspaceTags`

```typescript
{
  id: uuid (PK),
  workspaceId: uuid (FK → workspaces.id, cascade delete),

  name: varchar(100),               // Название тега
  category: enum('topic', 'format', 'tone', 'style', 'other'),

  // Метрики
  usageCount: integer,              // Сколько раз встречался в extractions
  isUserCreated: boolean,           // Создан пользователем или автоматически

  createdAt: timestamp,
  updatedAt: timestamp,
}
```

**Уникальность:**

- unique constraint на `(workspaceId, name, category)` — один тег с именем "marketing" может быть только в одной категории

**Индексы:**

- `(workspaceId, usageCount DESC)` — для сортировки по популярности
- `(workspaceId, category)` — для группировки по категориям

---

### 3.4 Обновление таблицы `workspaces`

Добавляем поле `mainPrompt`:

```typescript
// Добавить в существующую таблицу workspaces:
{
  // ... существующие поля

  mainPrompt: jsonb,  // Структурированный main prompt
}
```

**Структура `mainPrompt` (JSONB):**

```typescript
{
  brandVoice: string,          // "Professional yet approachable, data-driven"
  coreThemes: string[],        // ["marketing", "growth", "analytics"]
  targetAudience: string,      // "B2B SaaS marketers and founders"
  contentGoals: string[],      // ["educate", "inspire", "drive engagement"]
  avoidTopics: string[],       // ["politics", "religion"] (optional)
  preferredFormats: string[],  // ["carousel", "video", "thread"]
  additionalContext: string,   // Дополнительный контекст (optional)
  updatedAt: timestamp,        // Когда последний раз обновлялся
}
```

---

## 4. API Endpoints

### 4.1 Raw Inspirations

#### `POST /api/workspaces/:workspaceId/inspirations`

Создать новое вдохновение.

**Request:**

```typescript
{
  type: 'image' | 'link' | 'text' | 'document',
  content: string,              // URL или текст
  userDescription?: string,     // Описание от пользователя
  file?: File,                  // Для type=image или document (multipart/form-data)
}
```

**Validation:**

- `type=image`: требуется `file` (JPEG, PNG, WEBP), max 50MB
- `type=document`: требуется `file` (PDF, TXT, MD, DOCX), max 50MB
- `type=link`: требуется `content` (valid URL)
- `type=text`: требуется `content` (min 10 characters)
- `userDescription`: max 1000 characters

**Business Logic:**

1. Проверить дубликаты (для type=link): если URL уже существует в workspace → ошибка 409
2. Загрузить файл в S3 (если type=image)
3. Сохранить Raw Inspiration со статусом `processing`
4. Добавить задачу в BullMQ queue: `inspirations:process`
5. Вернуть созданный объект

**Response (201):**

```typescript
{
  id: string,
  workspaceId: string,
  type: string,
  content: string,
  imageUrl?: string,
  userDescription?: string,
  status: 'processing',
  createdAt: string,
}
```

**Errors:**

- 400: Invalid request
- 409: Duplicate inspiration (URL already exists)
- 413: File too large
- 415: Unsupported file type

---

#### `GET /api/workspaces/:workspaceId/inspirations`

Получить список вдохновений workspace.

**Query params:**

```typescript
{
  type?: 'image' | 'link' | 'text' | 'document',
  status?: 'processing' | 'completed' | 'failed',
  limit?: number,    // default 20, max 100
  offset?: number,   // default 0
}
```

**Response (200):**

```typescript
{
  items: [
    {
      id: string,
      workspaceId: string,
      type: string,
      content: string,
      imageUrl?: string,
      userDescription?: string,
      metadata?: object,
      status: string,
      errorMessage?: string,
      extraction?: {     // Если status=completed
        summary: string,
        keyTopics: string[],
        contentFormat: string,
        tone: string[],
        // ... остальные поля
      },
      createdAt: string,
      updatedAt: string,
    }
  ],
  total: number,
  limit: number,
  offset: number,
}
```

---

#### `GET /api/inspirations/:id`

Получить детали вдохновения.

**Response (200):**

```typescript
{
  id: string,
  workspaceId: string,
  type: string,
  content: string,
  imageUrl?: string,
  userDescription?: string,
  metadata?: object,
  parsedContent?: string,
  status: string,
  errorMessage?: string,
  extraction?: {
    summary: string,
    keyTopics: string[],
    contentFormat: string,
    tone: string[],
    targetAudience: string,
    keyInsights: string[],
    contentStructure: string,
    visualStyle?: string,
    suggestedTags: string[],
    llmModel: string,
    tokensUsed: number,
    createdAt: string,
  },
  createdAt: string,
  updatedAt: string,
}
```

**Errors:**

- 404: Inspiration not found

---

#### `PUT /api/inspirations/:id`

Обновить описание вдохновения.

**Request:**

```typescript
{
  userDescription: string,  // Новое описание
}
```

**Business Logic:**

- Можно обновлять только `userDescription`
- После обновления описания пересоздать Extraction? (опционально, можно добавить позже)

**Response (200):**

```typescript
{
    // ... полный объект inspiration
}
```

---

#### `DELETE /api/inspirations/:id`

Удалить вдохновение (cascade удалит extraction).

**Response (204):** No content

---

### 4.2 Workspace Tags

#### `GET /api/workspaces/:workspaceId/tags`

Получить все теги workspace.

**Query params:**

```typescript
{
  category?: 'topic' | 'format' | 'tone' | 'style' | 'other',
  sortBy?: 'name' | 'usageCount',  // default: usageCount
  order?: 'asc' | 'desc',          // default: desc
}
```

**Response (200):**

```typescript
{
  tags: [
    {
      id: string,
      name: string,
      category: string,
      usageCount: number,
      isUserCreated: boolean,
      createdAt: string,
      updatedAt: string,
    }
  ],
  total: number,
}
```

---

#### `POST /api/workspaces/:workspaceId/tags`

Добавить тег вручную.

**Request:**

```typescript
{
  name: string,          // max 100 characters
  category: 'topic' | 'format' | 'tone' | 'style' | 'other',
}
```

**Validation:**

- Проверить дубликаты: если тег с таким name и category уже существует → ошибка 409

**Response (201):**

```typescript
{
  id: string,
  name: string,
  category: string,
  usageCount: 0,
  isUserCreated: true,
  createdAt: string,
  updatedAt: string,
}
```

---

#### `PUT /api/workspaces/:workspaceId/tags/:tagId`

Обновить тег (только name).

**Request:**

```typescript
{
  name: string,
}
```

**Response (200):**

```typescript
{
    // ... обновленный тег
}
```

---

#### `DELETE /api/workspaces/:workspaceId/tags/:tagId`

Удалить тег.

**Response (204):** No content

---

### 4.3 Main Prompt

#### `GET /api/workspaces/:workspaceId/prompt`

Получить main prompt workspace.

**Response (200):**

```typescript
{
  brandVoice: string,
  coreThemes: string[],
  targetAudience: string,
  contentGoals: string[],
  avoidTopics?: string[],
  preferredFormats: string[],
  additionalContext?: string,
  updatedAt: string,
}
```

**Если не установлен:**

```typescript
{
  brandVoice: "",
  coreThemes: [],
  targetAudience: "",
  contentGoals: [],
  avoidTopics: [],
  preferredFormats: [],
  additionalContext: "",
  updatedAt: null,
}
```

---

#### `PUT /api/workspaces/:workspaceId/prompt`

Обновить main prompt.

**Request:**

```typescript
{
  brandVoice?: string,
  coreThemes?: string[],
  targetAudience?: string,
  contentGoals?: string[],
  avoidTopics?: string[],
  preferredFormats?: string[],
  additionalContext?: string,
}
```

**Business Logic:**

- Merge с существующим prompt (обновить только переданные поля)
- Обновить `updatedAt` timestamp

**Response (200):**

```typescript
{
    // ... обновленный main prompt
}
```

---

## 5. Сервисы и модули

### 5.1 Структура модуля `src/modules/inspiration/`

```
src/modules/inspiration/
├── controllers/
│   ├── inspirations.controller.ts
│   └── workspace-tags.controller.ts
├── entity/
│   ├── raw-inspiration.schema.ts
│   ├── inspirations-extraction.schema.ts
│   ├── workspace-tag.schema.ts
│   └── *.mappers.ts
├── repositories/
│   ├── inspirations-repository.interface.ts
│   ├── inspirations.repository.ts
│   ├── workspace-tags-repository.interface.ts
│   └── workspace-tags.repository.ts
├── routes/
│   ├── inspirations.routes.ts
│   └── workspace-tags.routes.ts
├── services/
│   ├── inspirations-service.interface.ts
│   ├── inspirations.service.ts
│   ├── content-parser-service.interface.ts
│   ├── content-parser.service.ts
│   ├── llm-extraction-service.interface.ts
│   ├── llm-extraction.service.ts
│   ├── workspace-tags-service.interface.ts
│   └── workspace-tags.service.ts
├── validation/
│   └── inspirations.schemas.ts
└── workers/
    └── process-inspiration.worker.ts
```

---

### 5.2 Основные сервисы

#### `InspirationsService`

**Методы:**

- `createInspiration(workspaceId, data)` — создать вдохновение
- `getInspirations(workspaceId, filters)` — получить список
- `getInspirationById(id)` — получить детали
- `updateInspiration(id, data)` — обновить описание
- `deleteInspiration(id)` — удалить вдохновение
- `checkDuplicate(workspaceId, url)` — проверить дубликат URL

---

#### `ContentParserService`

**Методы:**

- `parseUrl(url)` → `{title, description, content, metadata}`
- `parseDocument(file)` → `{content, metadata}`
- `extractVideoMetadata(url)` → `{title, description, author}`
- `normalizeContent(content, maxWords=1500)` → `string`

**Парсинг:**

- **Веб-страницы**: использовать библиотеку `cheerio` или `jsdom` для извлечения:
    - `<title>`, `<meta description>`, `<meta og:*>`
    - Основной контент (поиск `<article>`, `<main>` или largest text block)
- **YouTube/Vimeo**: использовать API или `yt-dlp` для метаданных
- **PDF**: `pdf-parse` или `pdfjs-dist`
- **DOCX**: `mammoth` или `docx`
- **TXT/MD**: прямое чтение

**Лимиты:**

- Максимум 1500 слов для `parsedContent`
- Timeout: 30 секунд на парсинг
- Если парсинг не удался → сохранить только URL/file в metadata

---

#### `LlmExtractionService`

**Методы:**

- `createExtraction(rawInspiration)` → `InspirationExtraction`
- `buildPromptForExtraction(rawInspiration)` → `string`

**Prompt для OpenAI:**

```
You are an AI content analyst. Analyze the following inspiration and extract structured information optimized for future content generation.

=== Raw Inspiration ===
Type: {type}
User Description: {userDescription}
Content: {parsedContent or imageUrl or text}

=== Task ===
Extract and return a JSON object with the following structure:
{
  "summary": "2-3 sentence summary of the inspiration",
  "keyTopics": ["topic1", "topic2", ...],
  "contentFormat": "video|article|thread|carousel|image|other",
  "tone": ["professional", "casual", "humorous", ...],
  "targetAudience": "description of target audience",
  "keyInsights": ["insight1", "insight2", ...],
  "contentStructure": "description of content structure (hook, body, cta)",
  "visualStyle": "description of visual style (if applicable)",
  "suggestedTags": ["tag1", "tag2", ...]
}

Focus on extracting actionable patterns, styles, and insights that can be used for future content creation.
```

**OpenAI Settings:**

- Model: `gpt-4o` (или `gpt-4o-mini` для экономии)
- Temperature: 0.3 (детерминированность)
- Max tokens: 1000

---

#### `WorkspaceTagsService`

**Методы:**

- `getTags(workspaceId, filters)` — получить теги
- `createTag(workspaceId, name, category)` — создать тег
- `updateTag(tagId, name)` — обновить тег
- `deleteTag(tagId)` — удалить тег
- `syncTagsFromExtraction(workspaceId, suggestedTags)` — обновить теги из extraction

**Логика `syncTagsFromExtraction`:**

1. Для каждого `suggestedTag` из extraction:
    - Определить category (можно через LLM или простую эвристику)
    - Если тег существует → увеличить `usageCount`
    - Если не существует → создать с `isUserCreated=false`, `usageCount=1`

---

### 5.3 Worker: Process Inspiration

**Queue:** `inspirations:process`

**Job payload:**

```typescript
{
  inspirationId: string,
}
```

**Workflow:**

1. Получить `rawInspiration` из БД
2. Парсинг контента (`ContentParserService.parseUrl/parseDocument`)
3. Сохранить `parsedContent` и `metadata` в БД
4. Создать extraction через LLM (`LlmExtractionService.createExtraction`)
5. Сохранить extraction в таблицу `inspirationsExtractions`
6. Синхронизировать workspace tags (`WorkspaceTagsService.syncTagsFromExtraction`)
7. Обновить статус `rawInspiration` на `completed`

**Error Handling:**

- Если парсинг не удался → продолжить с пустым `parsedContent`
- Если LLM запрос не удался → retry (max 3 attempts)
- Если все попытки провалились → статус `failed`, сохранить `errorMessage`

**Retry strategy:**

- 3 attempts
- Backoff: 5s, 30s, 2min

---

## 6. Обновление Workspace Service

Добавить методы в `WorkspaceService`:

```typescript
class WorkspaceService {
    // ... существующие методы

    async getMainPrompt(workspaceId: string): Promise<MainPrompt>
    async updateMainPrompt(workspaceId: string, data: Partial<MainPrompt>): Promise<MainPrompt>
}
```

**Main Prompt по умолчанию:**

- При создании workspace поле `mainPrompt` = `null`
- При первом запросе `GET /workspaces/:id/prompt` → вернуть пустую структуру
- Пользователь может заполнить вручную или оставить для автоматического обновления (feature для Phase 4)

---

## 7. Миграции базы данных

### Migration 1: Create rawInspirations table

```sql
CREATE TYPE inspiration_type AS ENUM ('image', 'link', 'text', 'document');
CREATE TYPE inspiration_status AS ENUM ('processing', 'completed', 'failed');

CREATE TABLE raw_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type inspiration_type NOT NULL,
  content TEXT,
  image_url VARCHAR(1024),
  user_description TEXT,

  metadata JSONB,
  parsed_content TEXT,

  status inspiration_status NOT NULL DEFAULT 'processing',
  error_message TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_inspirations_workspace ON raw_inspirations(workspace_id, created_at DESC);
CREATE INDEX idx_raw_inspirations_status ON raw_inspirations(workspace_id, status);
CREATE UNIQUE INDEX idx_raw_inspirations_url ON raw_inspirations(workspace_id, content) WHERE type = 'link';
```

### Migration 2: Create inspirationsExtractions table

```sql
CREATE TABLE inspirations_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_inspiration_id UUID NOT NULL REFERENCES raw_inspirations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  summary TEXT NOT NULL,
  key_topics TEXT[] NOT NULL DEFAULT '{}',
  content_format VARCHAR(50),
  tone TEXT[] NOT NULL DEFAULT '{}',
  target_audience TEXT,
  key_insights TEXT[] NOT NULL DEFAULT '{}',
  content_structure TEXT,
  visual_style TEXT,
  suggested_tags TEXT[] NOT NULL DEFAULT '{}',

  llm_model VARCHAR(50),
  tokens_used INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspirations_extractions_workspace ON inspirations_extractions(workspace_id, created_at DESC);
CREATE INDEX idx_inspirations_extractions_raw ON inspirations_extractions(raw_inspiration_id);
```

### Migration 3: Create workspaceTags table

```sql
CREATE TYPE tag_category AS ENUM ('topic', 'format', 'tone', 'style', 'other');

CREATE TABLE workspace_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  category tag_category NOT NULL,

  usage_count INTEGER NOT NULL DEFAULT 0,
  is_user_created BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_workspace_tags_unique ON workspace_tags(workspace_id, name, category);
CREATE INDEX idx_workspace_tags_usage ON workspace_tags(workspace_id, usage_count DESC);
```

### Migration 4: Add mainPrompt to workspaces

```sql
ALTER TABLE workspaces ADD COLUMN main_prompt JSONB;
```

---

## 8. Зависимости (npm packages)

Добавить в `package.json`:

```json
{
    "dependencies": {
        "cheerio": "^1.0.0-rc.12", // Парсинг HTML
        "pdf-parse": "^1.1.1", // Парсинг PDF
        "mammoth": "^1.6.0", // Парсинг DOCX
        "youtube-transcript": "^1.0.6", // YouTube транскрипты (optional)
        "openai": "^4.20.0" // OpenAI API (если еще не установлен)
    }
}
```

---

## 9. Этапы реализации

### **Phase 1: База данных + Raw Inspirations CRUD** ✅

**Задачи:**

1. Создать миграции для таблиц `rawInspirations`, `inspirationsExtractions`, `workspaceTags`
2. Создать entity schemas (Drizzle)
3. Создать repositories (InspirationsRepository, WorkspaceTagsRepository)
4. Создать validation schemas (Zod)
5. Создать InspirationsService (CRUD методы)
6. Создать InspirationsController
7. Создать routes
8. Проверка дубликатов для ссылок

**Endpoints:**

- ✅ POST `/workspaces/:id/inspirations` (без обработки LLM, статус сразу `completed`)
- ✅ GET `/workspaces/:id/inspirations`
- ✅ GET `/inspirations/:id`
- ✅ PUT `/inspirations/:id`
- ✅ DELETE `/inspirations/:id`

**Тестирование:**

- Создание inspirations всех типов (image, link, text, document)
- Загрузка файлов (изображения, PDF)
- Проверка дубликатов ссылок

---

### **Phase 2: Content Parsing + LLM Integration** 🔄

**Задачи:**

1. Создать ContentParserService
    - Парсинг веб-страниц (cheerio)
    - Парсинг PDF (pdf-parse)
    - Парсинг DOCX (mammoth)
    - Парсинг YouTube metadata
    - Нормализация контента (1500 слов)
2. Создать LlmExtractionService
    - Интеграция с OpenAI API
    - Построение промптов
    - Парсинг ответов
3. Создать BullMQ worker: `inspirations:process`
    - Workflow обработки
    - Error handling & retry
4. Обновить InspirationsService:
    - После создания inspiration → добавить job в очередь
    - Обновить статус после обработки

**Тестирование:**

- Парсинг разных типов контента
- Создание extractions через OpenAI
- Обработка ошибок (timeout, API errors)

---

### **Phase 3: Workspace Tags** 🔄

**Задачи:**

1. Создать WorkspaceTagsService
    - CRUD операции
    - Синхронизация тегов из extractions
2. Создать WorkspaceTagsController
3. Создать routes для tags
4. Интегрировать `syncTagsFromExtraction` в worker

**Endpoints:**

- ✅ GET `/workspaces/:id/tags`
- ✅ POST `/workspaces/:id/tags`
- ✅ PUT `/workspaces/:id/tags/:tagId`
- ✅ DELETE `/workspaces/:id/tags/:tagId`

**Тестирование:**

- Автоматическое создание тегов из extractions
- Обновление usageCount
- CRUD операции для пользовательских тегов

---

### **Phase 4: Main Prompt** 🔄

**Задачи:**

1. Добавить миграцию для `mainPrompt` в workspaces
2. Обновить WorkspaceService:
    - `getMainPrompt()`
    - `updateMainPrompt()`
3. Обновить WorkspaceController
4. Создать routes

**Endpoints:**

- ✅ GET `/workspaces/:id/prompt`
- ✅ PUT `/workspaces/:id/prompt`

**Тестирование:**

- Получение пустого prompt
- Обновление prompt (partial updates)
- Валидация структуры

---

### **Phase 5: (Future) Использование контекста при генерации постов** 📝

**Не входит в текущий scope, но нужно учесть при проектировании:**

При генерации поста через AI Module:

1. Получить последние N inspirations extractions
2. Получить workspace tags (топ по usageCount)
3. Получить main prompt
4. Построить расширенный промпт для LLM:

```
=== Workspace Context ===
Brand Voice: {mainPrompt.brandVoice}
Target Audience: {mainPrompt.targetAudience}
Core Themes: {mainPrompt.coreThemes.join(', ')}

=== Top Tags ===
{workspaceTags.slice(0, 20).map(t => t.name).join(', ')}

=== Recent Inspirations ===
{inspirations.map(i => i.extraction.summary).join('\n')}

=== Task ===
Generate a social media post for {platform} about {userInput}...
```

---

## 10. Валидация и ограничения

### File Upload

- **Изображения**: JPEG, PNG, WEBP, max 50MB
- **Документы**: PDF, TXT, MD, DOCX, max 50MB
- **Проверка MIME types** через `file-type` library

### Rate Limiting (optional, Phase 2+)

- Max 50 inspirations в час на workspace
- Max 5 одновременных обработок на workspace

### Content Parsing

- Timeout: 30 секунд
- Max content length: 1500 слов (~10,000 characters)
- Fallback: если парсинг не удался, сохранить только URL/filename

### OpenAI API

- Timeout: 60 секунд
- Max tokens: 1000 для response
- Retry: 3 attempts с exponential backoff
- Error handling: сохранить errorMessage в БД

---

## 11. Security & Permissions

### Authorization

Все endpoints требуют JWT authentication (`auth.middleware.ts`):

- Проверить, что пользователь имеет доступ к workspace
- Использовать существующую логику проверки ownership

### File Upload Security

- Проверка file extension
- Проверка MIME type (не доверять только extension)
- Scan на malware (optional, через ClamAV или cloud service)
- Хранение в S3 с private access

### URL Validation

- Проверить, что URL валидный (Zod)
- Whitelist протоколов: http, https
- Защита от SSRF: блокировать private IP ranges (127.0.0.1, 192.168.\*, etc)

---

## 12. Мониторинг и логирование

### Логи

- Все операции с inspirations (создание, обновление, удаление)
- Парсинг контента (успех/ошибка, длительность)
- LLM запросы (модель, tokens, стоимость)
- Синхронизация тегов

### Метрики (optional)

- Количество inspirations на workspace
- Success rate парсинга
- Средняя длительность обработки
- OpenAI tokens usage & cost

---

## 13. Тестирование

### Unit Tests

- Repositories: CRUD операции
- Services: бизнес-логика, проверка дубликатов
- ContentParserService: парсинг разных типов контента
- LlmExtractionService: построение промптов

### Integration Tests

- API endpoints: полный workflow
- Worker: обработка inspirations end-to-end
- Синхронизация тегов

### E2E Tests (optional)

- Создание inspiration → обработка → получение extraction
- Обновление workspace tags на основе extractions

---

## 14. Документация

После реализации обновить:

1. `docs/03-modules.md` — добавить описание Inspiration Module
2. `docs/04-database.md` — добавить новые таблицы
3. `docs/05-queues-workers.md` — добавить описание worker

---

## 15. Вопросы для обсуждения

### Resolved ✅

1. ✅ Дубликаты ссылок — блокировать
2. ✅ Структура extractions — утверждена
3. ✅ Main Prompt — структурированный объект
4. ✅ Лимит парсинга — 1500 слов
5. ✅ LLM модель — OpenAI
6. ✅ Background processing — через BullMQ

### Open Questions ❓

1. **Автообновление Main Prompt**: должна ли система автоматически обновлять main prompt на основе накопленных extractions? Или только manual update?
2. **Re-processing**: если пользователь обновляет `userDescription`, нужно ли пересоздать extraction?
3. **Удаление старых inspirations**: нужен ли механизм архивации/удаления старых inspirations (> 6 месяцев)?
4. **Импорт пакетом**: нужен ли bulk import (загрузка нескольких inspirations сразу)?
5. **Categorization tags**: кто определяет category для suggested tags (LLM или эвристика)?

---

## 16. Приоритеты и Timeline

**High Priority (MVP):**

- Phase 1: Raw Inspirations CRUD ✅
- Phase 2: Content Parsing + LLM ✅
- Phase 3: Workspace Tags ✅

**Medium Priority:**

- Phase 4: Main Prompt ✅

**Low Priority (Future):**

- Phase 5: Integration with Post Generation
- Bulk import
- Auto-update main prompt
- Re-processing on description update

**Estimated Timeline:**

- Phase 1: 3-4 days
- Phase 2: 5-7 days
- Phase 3: 2-3 days
- Phase 4: 1-2 days

**Total: ~2-3 weeks**

---

## 17. Success Criteria

**Phase 1 (Raw Inspirations):**

- ✅ Пользователь может добавить inspiration (все типы)
- ✅ Загрузка изображений в S3
- ✅ Блокировка дубликатов ссылок
- ✅ CRUD операции работают

**Phase 2 (LLM Integration):**

- ✅ Контент парсится корректно (веб, PDF, DOCX)
- ✅ OpenAI создает extraction
- ✅ Extraction сохраняется в БД
- ✅ Error handling работает

**Phase 3 (Workspace Tags):**

- ✅ Теги создаются автоматически из extractions
- ✅ usageCount обновляется корректно
- ✅ Пользователь может управлять тегами

**Phase 4 (Main Prompt):**

- ✅ Пользователь может читать/обновлять main prompt
- ✅ Структура данных корректна

---

Готово! Это полное техническое задание для системы вдохновений ZapShipr. 🚀
