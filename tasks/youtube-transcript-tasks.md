# YouTube Transcript Extraction - Декомпозиция задач

## Анализ текущей реализации

### ✅ Что УЖЕ реализовано:
- Базовая архитектура модуля inspirations (repository, service, controller, routes)
- Таблицы БД: `raw_inspirations`, `inspirations_extractions`
- Типы inspirations: image, link, text, document
- Статусы: processing, completed, failed
- ContentParserService - парсит YouTube ссылки (через API, scraping, oEmbed)
- Базовое извлечение videoId из разных форматов YouTube URL
- Получение метаданных через YouTube Data API
- LLM Extraction через OpenAI с JSON Schema
- Worker для обработки inspirations (BullMQ)
- Дедупликация по URL
- Retry механизм с exponential backoff

### ❌ Что НУЖНО добавить:
1. Полная нормализация YouTube URL в `CanonicalVideoRef` формат
2. Получение ТРАНСКРИПТА видео (сейчас только description!)
3. Fallback-цепочка: Human captions → Auto captions → STT
4. Таблица Transcripts в БД
5. Нормализация транскрипта (очистка VTT/SRT)
6. Chunking для длинных транскриптов
7. Map-Reduce для длинных транскриптов
8. Новая JSON Schema для extraction (hooks, quotes с таймкодами, drafts по платформам)
9. Quality Gate - валидация минимумов
10. Промежуточные статусы (TRANSCRIPT_READY, EXTRACTED)

---

# Epic: YouTube Transcript Extraction

Реализация полноценного пайплайна получения транскрипта YouTube видео и генерации структурированных идей для постов.

## Зависимости эпика
- Требуется yt-dlp для скачивания субтитров/аудио
- OpenAI Whisper API для STT fallback
- Текущая инфраструктура inspiration worker

---

# Phase 1: URL Normalizer & Types

## Task: Создать тип CanonicalVideoRef и URL нормализатор

**Описание:**
Создать детерминированный нормализатор YouTube URL, который превращает любой формат ссылки в единый канонический формат.

**Acceptance Criteria:**
- Создать тип `CanonicalVideoRef` в `src/modules/inspiration/types/youtube.types.ts`
- Создать функцию `normalizeYouTubeUrl()` в `src/modules/inspiration/utils/youtube-url-normalizer.ts`
- Поддержка форматов: watch, youtu.be, shorts, embed
- Парсинг `t`/`start` в `startSec` (форматы: `1h2m3s`, `90`, `90s`)
- Игнорирование маркетинговых параметров (`pp`, `si`, `feature`, `utm_*`)
- Извлечение `playlistId` (если есть)
- Unit тесты для всех форматов URL

**Labels:** youtube, phase-1, types

---

# Phase 2: Transcript Provider

## Task: Создать таблицу transcripts в БД

**Описание:**
Добавить миграцию и entity для хранения транскриптов видео.

**Acceptance Criteria:**
- Создать schema `src/modules/inspiration/entity/transcript.schema.ts`
- Поля: id, inspiration_id, language, source (HUMAN_CAPTIONS | AUTO_CAPTIONS | STT), format, raw, normalized_text, segments (JSONB)
- Создать миграцию
- Экспортировать в `src/db/schema.ts`

**Labels:** youtube, phase-2, database

---

## Task: Создать TranscriptRepository

**Описание:**
Репозиторий для работы с транскриптами.

**Acceptance Criteria:**
- Интерфейс `ITranscriptRepository`
- Реализация `TranscriptRepository`
- CRUD операции + findByInspirationId + findByVideoIdAndLanguage (для кэша)

**Labels:** youtube, phase-2, repository

---

## Task: Интегрировать yt-dlp для получения субтитров

**Описание:**
Создать сервис для получения субтитров YouTube через yt-dlp.

**Acceptance Criteria:**
- Создать `src/modules/inspiration/services/transcript-provider/transcript-provider.service.ts`
- Интерфейс `ITranscriptProviderService`
- Метод `getAvailableCaptions(videoId)` - список доступных субтитров
- Метод `downloadCaptions(videoId, language, preferHuman)` - скачивание VTT/SRT
- Fallback-цепочка: human (preferredLang) → human (any) → auto (preferredLang) → auto (any)
- Обработка ошибок (video unavailable, region lock, age restriction)

**Labels:** youtube, phase-2, yt-dlp, core

---

## Task: Реализовать STT fallback через OpenAI Whisper

**Описание:**
Если субтитры недоступны, скачать аудио и транскрибировать через Whisper API.

**Acceptance Criteria:**
- Метод `downloadAudio(videoId)` через yt-dlp
- Метод `transcribeAudio(audioPath, language?)` через OpenAI Whisper API
- Временное хранение аудио с автоудалением после транскрибации
- Обработка лимитов (размер файла, длительность)
- Логирование использования и стоимости

**Labels:** youtube, phase-2, stt, openai

---

# Phase 3: Transcript Processing

## Task: Создать TranscriptNormalizerService

**Описание:**
Сервис для очистки и нормализации транскриптов.

**Acceptance Criteria:**
- Парсинг VTT формата
- Парсинг SRT формата
- Удаление таймкодов и метаданных
- Удаление повторяющихся фраз (характерно для auto captions)
- Нормализация пробелов и переносов
- Сохранение сегментов с таймкодами в структурированном виде
- Unit тесты

**Labels:** youtube, phase-3, normalizer

---

## Task: Реализовать Chunking для длинных транскриптов

**Описание:**
Разбиение длинных транскриптов на чанки для LLM.

**Acceptance Criteria:**
- Функция `chunkTranscript(text, maxTokens, segments?)` в utils
- Размер чанка: 2000-4000 токенов (настраиваемо)
- Разрезание по границам сегментов/предложений
- Сохранение связи с таймкодами
- Метрика: количество чанков, средний размер

**Labels:** youtube, phase-3, chunking

---

## Task: Обновить статусы inspiration

**Описание:**
Добавить промежуточные статусы для отслеживания прогресса.

**Acceptance Criteria:**
- Добавить статусы: `transcript_fetching`, `transcript_ready`, `extracting`
- Миграция для обновления enum
- Обновить типы и интерфейсы

**Labels:** youtube, phase-3, database, status

---

# Phase 4: LLM Extraction Update

## Task: Обновить JSON Schema для YouTube extraction

**Описание:**
Новая схема extraction специально для YouTube транскриптов с расширенными полями.

**Acceptance Criteria:**
- Новые поля: `hooks` (10-30), `quotes` с таймкодами, `content_angles`, `drafts` по платформам
- Поддержка `title_guess`, `language`
- Сохранение обратной совместимости с существующими extractions
- Валидация через JSON Schema

**Labels:** youtube, phase-4, llm, schema

---

## Task: Реализовать Map-Reduce для длинных транскриптов

**Описание:**
Двухпроходная обработка длинных транскриптов через LLM.

**Acceptance Criteria:**
- Pass A (Map): чанки → chunk_notes (тезисы, цитаты, темы)
- Pass B (Reduce): все chunk_notes → финальный extraction
- Порог для переключения: ~6000 токенов транскрипта
- Логирование токенов и стоимости для каждого прохода

**Labels:** youtube, phase-4, llm, map-reduce

---

## Task: Реализовать Quality Gate

**Описание:**
Валидация качества extraction с автоматическим retry.

**Acceptance Criteria:**
- Проверка минимумов: hooks >= 10, key_points >= 5, quotes >= 3, drafts не пустые
- Проверка на "воду" (слишком общие формулировки)
- 1 автоматический retry с усиленными требованиями в промпте
- Логирование качества и причин retry

**Labels:** youtube, phase-4, quality, validation

---

# Phase 5: Worker & Integration

## Task: Обновить InspirationWorker для YouTube workflow

**Описание:**
Интегрировать новый пайплайн в существующий worker.

**Acceptance Criteria:**
- Определение типа контента (YouTube vs другие)
- Для YouTube: URL normalize → metadata fetch → transcript fetch → normalize → chunk → extract
- Обновление статусов на каждом шаге
- Сохранение transcript в БД
- Обработка ошибок с понятными сообщениями

**Labels:** youtube, phase-5, worker, integration

---

## Task: Добавить кэширование транскриптов

**Описание:**
Кэширование для избежания повторных запросов.

**Acceptance Criteria:**
- Ключ кэша: `videoId + language + source`
- Проверка кэша перед запросом транскрипта
- Ключ для extraction: `inspirationId + schema_version + model`
- TTL для аудио файлов

**Labels:** youtube, phase-5, cache, optimization

---

## Task: Добавить endpoint POST /inspirations/:id/extract

**Описание:**
Ручной запуск extraction для inspiration.

**Acceptance Criteria:**
- Endpoint в routes
- Валидация (только для завершённых транскриптов)
- Возможность повторной extraction с другими параметрами

**Labels:** youtube, phase-5, api

---

# Phase 6: Testing & Documentation

## Task: Unit тесты для YouTube модуля

**Описание:**
Покрытие тестами новых компонентов.

**Acceptance Criteria:**
- Тесты для URL normalizer (все форматы)
- Тесты для VTT/SRT parser
- Тесты для chunker
- Тесты для quality gate
- Mocks для yt-dlp и OpenAI

**Labels:** youtube, phase-6, testing

---

## Task: Integration тесты

**Описание:**
E2E тесты пайплайна.

**Acceptance Criteria:**
- Тест: URL → transcript → extraction (с mock yt-dlp)
- Тест: видео без субтитров → STT → extraction
- Тест: длинный транскрипт → chunking → map-reduce → extraction
- Тест: ошибка → retry → success/fail

**Labels:** youtube, phase-6, testing, integration

---

## Task: Обновить документацию

**Описание:**
Документация нового функционала.

**Acceptance Criteria:**
- Обновить docs/03-modules.md
- Обновить docs/05-queues-workers.md
- Добавить описание YouTube workflow
- Примеры API запросов

**Labels:** youtube, phase-6, documentation

---

# Порядок выполнения

1. **Phase 1** - URL Normalizer (1 task) - ~2h
2. **Phase 2** - Transcript Provider (4 tasks) - ~8h
3. **Phase 3** - Transcript Processing (3 tasks) - ~4h
4. **Phase 4** - LLM Extraction Update (3 tasks) - ~6h
5. **Phase 5** - Worker & Integration (3 tasks) - ~4h
6. **Phase 6** - Testing & Documentation (3 tasks) - ~4h

**Общая оценка: ~28 часов**

