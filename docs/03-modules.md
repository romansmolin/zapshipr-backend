# Модули проекта

## Auth Module (`src/modules/auth/`)

**Назначение**: Аутентификация и авторизация пользователей

**Функции**:
- Регистрация и вход (email/password)
- Google OAuth
- JWT токены (access + refresh)
- Смена пароля
- Восстановление пароля

**Use Cases**: 
- `sign-up.ts` — регистрация пользователя
- `sing-in.ts` — вход в систему
- `logout.ts` — выход из системы
- `change-password.ts` — смена пароля
- `forget-password.ts` — восстановление пароля

## User Module (`src/modules/user/`)

**Назначение**: Управление профилями пользователей

**Функции**: 
- Получение информации о пользователе
- Обновление профиля

## Workspace Module (`src/modules/workspace/`)

**Назначение**: Управление рабочими пространствами (workspace)

**Функции**:
- Создание workspace с именем, описанием и аватаркой
- Получение списка workspace пользователя
- Обновление workspace
- Удаление workspace
- Загрузка аватарки workspace

**Особенности**:
- Каждый пост и аккаунт социальной сети привязан к workspace
- Фильтрация постов и аккаунтов по workspace
- Cascade удаление: при удалении workspace удаляются все связанные посты и аккаунты

## Post Module (`src/modules/post/`)

**Назначение**: Управление постами

**Функции**:
- Создание постов с медиа
- Редактирование постов
- Удаление постов
- Фильтрация и поиск постов
- Планирование публикаций
- Повторная попытка публикации

**Особенности**:
- Проверка совместимости медиа с платформами
- Поддержка множественных медиа-файлов
- Статусы постов: pending, published, failed
- Связь постов с аккаунтами через `postTargets`

## Social Module (`src/modules/social/`)

**Назначение**: Интеграции с социальными сетями

**Структура**:
- `connectors/` — OAuth подключение аккаунтов (9 платформ)
- `publishers/` — публикация контента на платформы
- `services/` — бизнес-логика работы с аккаунтами
- `repositories/` — доступ к данным аккаунтов

**Поддерживаемые платформы**:
- Facebook, Instagram, Threads
- LinkedIn, X (Twitter)
- TikTok, YouTube
- Pinterest, Bluesky

**Use Cases**:
- Подключение/отключение аккаунтов
- Обновление токенов доступа
- Получение списка аккаунтов
- Получение Pinterest досок

## AI Module (`src/modules/ai/`)

**Назначение**: AI функциональность (генерация контента)

**Функции**:
- Генерация текста для постов
- Оптимизация контента

## Email Module (`src/modules/email/`)

**Назначение**: Отправка email уведомлений

**Функции**:
- Отправка транзакционных писем
- Уведомления о публикациях

## Inspiration Module (`src/modules/inspiration/`)

**Назначение**: Система сбора и анализа вдохновений для контента

**Функции**:
- Создание inspirations из различных источников (ссылки, изображения, тексты, документы)
- Автоматический парсинг контента из URL
- Извлечение транскриптов из YouTube видео
- LLM-анализ контента и генерация идей для постов
- Хранение и поиск inspirations

### YouTube Transcript Pipeline

Специализированная обработка YouTube видео:

1. **URL Normalizer** (`utils/youtube-url-normalizer.ts`)
   - Нормализация различных форматов YouTube URL (watch, youtu.be, shorts, embed)
   - Извлечение videoId, timestamp, playlist ID
   - Игнорирование маркетинговых параметров

2. **Transcript Provider** (`services/transcript-provider/`)
   - Получение субтитров через yt-dlp (human → auto captions)
   - Fallback на OpenAI Whisper STT при отсутствии субтитров
   - Кэширование транскриптов по videoId

3. **Transcript Normalizer** (`services/transcript-normalizer/`)
   - Парсинг VTT/SRT форматов
   - Удаление дубликатов фраз
   - Сохранение таймкодов сегментов

4. **Chunking** (`utils/transcript-chunker.ts`)
   - Разбиение длинных транскриптов на токен-ограниченные чанки
   - Сохранение границ предложений и таймингов

5. **LLM Extraction** (`services/llm-extraction/`)
   - **Single Pass**: для коротких транскриптов (< 6000 токенов)
   - **Map-Reduce**: для длинных транскриптов
     - Map: извлечение тезисов из каждого чанка
     - Reduce: синтез финального extraction
   - **Quality Gate**: валидация качества с автоматическим retry

### YouTube Extraction Schema

```typescript
interface YouTubeExtractionData {
  titleGuess: string       // Угаданное название видео
  language: string         // Язык контента
  summary: string          // Краткое содержание
  keyPoints: string[]      // 5-15 ключевых тезисов
  hooks: string[]          // 10-30 хуков для постов
  quotes: YouTubeQuote[]   // Цитаты с таймкодами
  contentAngles: ContentAngle[]  // Углы подачи
  drafts: PlatformDrafts   // Готовые черновики
  tags: string[]           // 5-25 тегов
  tone: string            // Тон контента
}
```

### API Endpoints

- `POST /workspaces/:workspaceId/inspirations` — создать inspiration
- `GET /workspaces/:workspaceId/inspirations` — список inspirations
- `GET /workspaces/:workspaceId/inspirations/:id` — получить с extraction
- `POST /workspaces/:workspaceId/inspirations/:id/retry` — повторить обработку
- `POST /workspaces/:workspaceId/inspirations/:id/extract` — запустить extraction

## Waitlist Module (`src/modules/waitlist/`)

**Назначение**: Управление waitlist и реферальной программой

**Функции**:
- Регистрация в waitlist
- Реферальная система
- Награды за рефералов

