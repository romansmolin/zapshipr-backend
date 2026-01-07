# YouTube → Transcript → Ideas Extraction (ZapShipr Inspirations)

Документ описывает реализацию функционала, который **берёт транскрипт видео** (YouTube/любой источник) и превращает его в **структурированные идеи для постов**: хуки, тезисы, цитаты, углы контента и готовые черновики под платформы.

---

## 1) Цели

### 1.1 Что должно уметь

- Принимать “inspiration” типа `youtube_url`.
- Получать **транскрипт**:
    1. Human captions (если есть)
    2. Auto captions (если есть)
    3. Fallback: Audio → Speech-to-Text (STT)

- Нормализовать текст: очистка, язык, сегментация.
- Генерировать **structured extraction** (валидный JSON по схеме):
    - `summary`
    - `key_points`
    - `hooks`
    - `quotes` (желательно с таймкодами)
    - `content_angles`
    - `drafts` под платформы (Threads / X / LinkedIn / IG caption)
    - `tags` / `topics` / `tone`

### 1.2 Не-цели (на первом этапе)

- Не делаем “идеальный” детектор языков/диалектов.
- Не делаем сложный “факт-чекинг”.
- Не делаем авто-постинг (это отдельный модуль продукта).

---

## 2) Новый workflow (v2) — детерминированный разбор ссылки → транскрипт → extraction

Ниже workflow, который решает проблему “мне не нравится как мы анализуем ссылку”, не трогая твой готовый промпт для extraction.

### Шаг 0 — Ingest (как сейчас)

- Принимаем `source_url`.
- Создаём `Inspiration` со статусом `PENDING`.

### Шаг 1 — Normalize URL (единственная точка истины)

**Input:** `source_url`

**Action:** `normalizeYouTubeUrl(source_url) -> CanonicalVideoRef`

- Достаём `videoId` из любых форматов (watch / youtu.be / shorts / embed).
- Парсим `t`/`start` в `startSec` (поддержка `1h2m3s`, `90`, `90s`).
- Игнорируем шумовые параметры (`pp`, `si`, `feature`, `utm_*`).
- Собираем `canonicalUrl = https://www.youtube.com/watch?v=<videoId>`

**Output:** `canonical_ref`

> Все следующие шаги работают ТОЛЬКО с `canonical_ref`, а не с сырой ссылкой.

### Шаг 2 — Light Metadata Fetch (быстро, но сильно улучшает анализ)

**Input:** `canonical_ref.videoId`

**Action:** `fetchMetadata(videoId)`

- `title`, `channelTitle`, `durationSec`
- (опционально) `publishedAt`

**Use cases:**

- Дедупликация (одинаковый videoId)
- UX (показать пользователю что анализируется)
- Стратегия чанкинга/лимиты

### Шаг 3 — Decide Scope (playlist/timestamp/shorts)

- Если `playlistId` присутствует: анализируем **только** `videoId` (если нет отдельного режима playlist-import).
- Если есть `startSec`: сохраняем его в `analysis_window.startSec`.
- `analysis_window.endSec`:
    - если пользователь явно не задавал — `null` (всё видео)
    - (опционально) для shorts можно ставить `min(durationSec, 60)`

### Шаг 4 — Transcript Strategy (human → auto → STT)

**Input:** `canonical_ref`, `preferredLanguage` (из workspace), `analysis_window`

**Action:** `getTranscript(canonical_ref, preferredLanguage)`

1. `tryHumanCaptions(preferredLanguage)`
2. если нет — `tryHumanCaptions(any)`
3. если нет — `tryAutoCaptions(preferredLanguage)`
4. если нет — `tryAutoCaptions(any)`
5. если нет — `downloadAudio(videoId)` → `openaiSTT(audio, preferredLanguage?)`

**Output:**

- `TranscriptFetchResult { source, language, raw, segments? }`

### Шаг 5 — Normalize Transcript

- Конвертируем VTT/SRT → чистый `normalized_text`.
- Если есть `segments`/таймкоды: режем по `analysis_window` (start/end).
- Удаляем мусор/повторы, выравниваем пробелы.

### Шаг 6 — Chunking

- Делим `normalized_text` на чанки по ~2k–4k токенов.
- Если есть segments: стараемся резать по границам сегментов/предложений.

### Шаг 7 — Extraction (твой готовый промпт)

Вариант A (короткие транскрипты):

- Один запрос LLM: `prompt + full_text` → extraction JSON

Вариант B (длинные):

- **Map:** на каждый chunk → `chunk_notes` (тезисы/цитаты/темы)
- **Reduce:** `all_chunk_notes` → финальный extraction JSON

### Шаг 8 — Quality Gate + Auto-fix

- Валидируем JSON по схеме.
- Проверяем минимумы: hooks/key_points/quotes/drafts.
- Если не прошло: 1 быстрый retry с усиленными требованиями.

### Шаг 9 — Persist + Cache

Сохраняем:

- `canonical_ref` (как часть inspiration metadata)
- `metadata`
- `transcript.raw` + `normalized_text` + `segments`
- `extraction.json`

Кэш-ключи:

- transcript: `videoId + language + source + analysis_window`
- extraction: `inspirationId + schema_version + model + prompt_version`

### Шаг 10 — UI/Status

- `TRANSCRIPT_READY` после шага 5
- `EXTRACTED` после шага 9
- `FAILED` с кодом ошибки и рекомендацией (например: “no_captions_no_audio_access”)

---

## 3) Разбор ссылки и метаданные (улучшение "анализируем ссылку")

Твоя боль, судя по описанию: **не нравится, как система “понимает” YouTube-ссылку** и выбирает, что именно анализировать.

### 3.1 Нормализация URL → канонический объект

Сделай один детерминированный шаг, который превращает _любую_ YouTube-ссылку в один формат:

**Вход:**

- `https://www.youtube.com/watch?v=VIDEO_ID&t=90s&pp=...`
- `https://youtu.be/VIDEO_ID?t=90`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

**Выход (пример):**

```ts
type CanonicalVideoRef = {
    provider: 'youtube'
    videoId: string
    startSec: number | null
    endSec: number | null
    isShorts: boolean
    playlistId: string | null
    rawUrl: string
    canonicalUrl: string // https://www.youtube.com/watch?v=...
}
```

Правила:

- Всегда извлекай `videoId` (из `v`, path, `embed`, `shorts`).
- `t`/`start` конвертируй в `startSec` (поддержка `1h2m3s`, `90`, `90s`).
- Игнорируй маркетинговые параметры (`pp`, `si`, `feature`, `utm_*`) — они не должны влиять на анализ.
- Храни `rawUrl` и `canonicalUrl` отдельно.

### 3.2 Метаданные (минимум, чтобы лучше анализировать)

Даже если эндпоинты уже есть, добавь “light metadata fetch” перед анализом:

- `title`
- `channelTitle`
- `durationSec`
- `publishedAt` (опционально)

Это нужно для:

- правильного чанкинга (очень длинные видео)
- UX (показывать пользователю, что именно анализируется)
- дедупликации (videoId + lang + source)

### 3.3 Разруливание «плейлист vs видео»

Если URL содержит `list=`:

- анализируй **только конкретный videoId** (если есть `v=`)
- либо добавь отдельный режим “playlist import” (позже)

### 3.4 Точка истинности

Весь дальнейший пайплайн должен принимать **только `CanonicalVideoRef`**, а не сырой URL.

---

## 4) Data Model (пример)

### 3.1 Таблицы / коллекции

#### Inspirations

- `id`
- `workspace_id`
- `type` = `YOUTUBE`
- `source_url`
- `status` = `PENDING | TRANSCRIPT_READY | EXTRACTED | FAILED`
- `created_at`, `updated_at`

#### Transcripts

- `id`
- `inspiration_id`
- `language` (e.g. `en`, `ru`)
- `source` = `HUMAN_CAPTIONS | AUTO_CAPTIONS | STT`
- `format` = `VTT | SRT | TEXT | JSON_SEGMENTS`
- `raw` (blob/text)
- `normalized_text` (text)
- `segments` (json; optional: [{startSec, endSec, text}])
- `created_at`

#### Extractions

- `id`
- `inspiration_id`
- `schema_version`
- `json` (structured extraction)
- `model` (e.g. `gpt-4o-mini`)
- `tokens_in`, `tokens_out`
- `created_at`

---

## 4) Transcript Provider

> Важно: YouTube Data API **часто** не позволяет скачивать чужие сабы. Поэтому для “пользователь даёт любую ссылку” нужен fallback-план.

### 4.1 Стратегии получения транскрипта (по приоритету)

1. **Human captions**
    - Если доступны — скачиваем и используем.

2. **Auto captions**
    - Если доступны — используем.

3. **STT (Speech-to-Text)**
    - Скачиваем аудио → отправляем в OpenAI Audio Transcription → получаем текст (+опционально сегменты).

### 4.2 Реализация (практичный вариант)

- Используем `yt-dlp` как “workhorse”:
    - узнать, есть ли `subtitles` и/или `automatic_captions`
    - скачать лучший вариант VTT

- Если ничего нет:
    - скачать аудио (например, mp3/m4a)
    - прогнать через OpenAI STT

### 4.3 Контракты

#### TranscriptFetchResult

```ts
type TranscriptSource = 'HUMAN_CAPTIONS' | 'AUTO_CAPTIONS' | 'STT'

type TranscriptFetchResult = {
    source: TranscriptSource
    language: string | null
    rawFormat: 'VTT' | 'SRT' | 'TEXT' | 'JSON_SEGMENTS'
    raw: string
    segments?: Array<{ startSec: number; endSec: number; text: string }>
}
```

---

## 5) Transcript Normalizer

### 5.1 Очистка VTT/SRT

- удалить таймкоды, номера строк, WEBVTT headers
- удалить повторяющиеся фразы (часто в авто-сабах)
- привести пробелы/переносы
- (опционально) восстановить пунктуацию через LLM или простые правила

### 5.2 Сегментация

Цель: чтобы extractor получал текст “кусками”, если транскрипт большой.

Рекомендация:

- Чанк: ~2,000–4,000 токенов (зависит от модели)
- Разделение по предложениям/абзацам
- Сохранять связь с таймкодами (если есть segments)

---

## 6) Idea Extractor (LLM)

### 6.1 Основной принцип

LLM не должен “болтать” — он должен вернуть **валидный JSON по схеме**.

### 6.2 JSON Schema (пример v1)

```json
{
    "name": "inspiration_extraction_v1",
    "schema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "title_guess": { "type": "string" },
            "language": { "type": "string" },

            "summary": { "type": "string" },

            "key_points": {
                "type": "array",
                "items": { "type": "string" },
                "minItems": 5,
                "maxItems": 15
            },

            "hooks": {
                "type": "array",
                "items": { "type": "string" },
                "minItems": 10,
                "maxItems": 30
            },

            "quotes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "text": { "type": "string" },
                        "startSec": { "type": ["number", "null"] },
                        "endSec": { "type": ["number", "null"] }
                    },
                    "required": ["text", "startSec", "endSec"]
                },
                "minItems": 3,
                "maxItems": 20
            },

            "content_angles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "angle": { "type": "string" },
                        "why_it_works": { "type": "string" }
                    },
                    "required": ["angle", "why_it_works"]
                },
                "minItems": 5,
                "maxItems": 15
            },

            "drafts": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "threads": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 2,
                        "maxItems": 5
                    },
                    "x": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 2,
                        "maxItems": 5
                    },
                    "linkedin": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "maxItems": 3
                    },
                    "instagram_caption": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "maxItems": 3
                    }
                },
                "required": ["threads", "x", "linkedin", "instagram_caption"]
            },

            "tags": {
                "type": "array",
                "items": { "type": "string" },
                "minItems": 5,
                "maxItems": 25
            },

            "tone": { "type": "string" }
        },
        "required": [
            "title_guess",
            "language",
            "summary",
            "key_points",
            "hooks",
            "quotes",
            "content_angles",
            "drafts",
            "tags",
            "tone"
        ]
    }
}
```

---

## 7) Prompting Strategy

### 7.1 System prompt (идея)

- Ты “Content Extractor”
- Не выдумываешь факты, работаешь только с transcript
- Если сомневаешься — формулируешь нейтрально
- Возвращаешь JSON строго по схеме

### 7.2 User prompt (шаблон)

Вставляем:

- язык пользователя/воркспейса
- платформы
- стиль бренда (ZapShipr/voice)
- транскрипт (чанком или целиком)

Пример:

```text
You are given a transcript of a video.
Extract content ideas for social posts.

Rules:
- Use ONLY the transcript.
- Prefer concrete, actionable insights.
- Provide hooks, key points, quotes, angles, and drafts.
- Return a JSON that matches the given schema. No extra text.

Transcript:
<<<TRANSCRIPT_TEXT>>>
```

### 7.3 Большие транскрипты: 2-проходная схема

1. **Pass A: Map**
    - на чанках получить “chunk_notes” (короткие тезисы + цитаты + таймкоды)

2. **Pass B: Reduce**
    - собрать итоговый extraction из всех chunk_notes

Это повышает качество и снижает риск потери контекста.

---

## 8) OpenAI API интеграция

### 8.1 STT (fallback)

- Вход: аудиофайл (mp3/m4a/wav)
- Выход: текст (+опционально сегменты)
- Сохраняем: `raw transcript`, `normalized`, `segments`

### 8.2 Extraction (structured outputs)

- Модель: быстрая/дешёвая для начала, затем переключаемся по тарифу/качества
- Включить строгую схему (JSON Schema)

---

## 9) Ошибки и фоллбеки

### 9.1 Ошибки получения транскрипта

- видео недоступно / region lock / age restriction
- нет сабов
- yt-dlp сломался (обновление)
- скачивание аудио упало

Fallback:

- повторить с другим форматом
- переключить прокси/регион (если допустимо политикой)
- STT (если аудио доступно)

### 9.2 Ошибки LLM

- модель вернула невалидный JSON
- пустые массивы/мало элементов
- слишком общие идеи (“вода”)

Решение:

- строгая схема + автоматический retry 1–2 раза
- добавить “quality guardrails” в prompt (минимумы, “конкретика/цифры”)
- если очень плохо: сделать re-run на более сильной модели

---

## 10) Кэширование и дедупликация

- Ключ: `video_id + language + transcript_source`
- Если уже есть transcript — не скачиваем заново
- Если уже есть extraction (schema_version + model) — не генерируем повторно

---

## 11) Метрики качества (MVP)

Считаем:

- % успешных transcript fetch
- % successful extraction
- среднее время пайплайна
- tokens / cost per inspiration
- “quality score” (простая эвристика):
    - hooks >= 10
    - key_points >= 5
    - quotes >= 3
    - drafts не пустые
    - нет повторов (basic similarity check)

---

## 12) Security & Compliance (кратко)

- Не хранить секреты в логах
- Хранить аудио временно (TTL) или сразу удалять после STT
- Ограничения на размер файла и длительность
- Чётко описать пользователям: что происходит с их ссылками/текстами (privacy)

---

## 13) Тест-план

### 13.1 Набор кейсов

- видео с human captions
- видео только с auto captions
- видео без captions (STT)
- видео очень длинное (чанкинг)
- видео недоступно (ожидаемый FAIL)
- разные языки (en/ru)

### 13.2 Автотесты

- unit: VTT cleaner, chunker
- integration: transcript provider
- e2e: url → extraction JSON (валидный по схеме)

---

## 14) Roadmap улучшений

- Мультиязычность: авто-определение языка + перевод drafts
- “Brand voice” per workspace (main prompt / tone)
- Привязка цитат к таймкодам + “open at timestamp”
- Реранжирование идей по “виртуальной вероятности успеха”
- Обучение персонализации по прошлым постам пользователя

---

## 15) Мини-спека эндпоинтов (пример)

### POST /inspirations

- body: `{ type: "YOUTUBE", url: string }`
- returns: `{ inspirationId }`

### POST /inspirations/:id/extract

- запускает pipeline
- returns: `{ status }`

### GET /inspirations/:id

- returns: inspiration + transcript + extraction
