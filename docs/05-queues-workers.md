# Очереди и воркеры

## BullMQ

Проект использует BullMQ для фоновой обработки задач с Redis в качестве брокера сообщений.

### Архитектура

- **Конфигурация**: `src/shared/queue/`
- **Воркеры**: `src/workers/`
- **Точка входа**: `src/worker.ts`
- **Отдельный процесс**: `npm run worker:dev`

### Типы задач

#### 1. Публикация постов в соцсети
- Обработка запланированных публикаций
- Отправка постов на платформы через publishers
- Обновление статусов `postTargets`

#### 2. Обновление токенов доступа
- Периодическая проверка истекающих токенов
- Автоматическое обновление через refresh tokens
- Обработка ошибок обновления

#### 3. Обработка медиа-файлов
- Конвертация видео в совместимые форматы
- Оптимизация изображений
- Загрузка в S3

#### 4. Обработка Inspirations
- Парсинг контента из URL
- Извлечение транскриптов из YouTube
- LLM extraction и генерация идей

### YouTube Inspiration Workflow

```
┌──────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│  processing  │────▶│ transcript_fetching │────▶│  transcript_ready  │
└──────────────┘     └─────────────────────┘     └────────────────────┘
                                                          │
                     ┌──────────┐                         ▼
                     │  failed  │◀────────────┬──────────────────────┐
                     └──────────┘             │       extracting     │
                                              │ └────────────────────┘
                     ┌───────────┐            │           │
                     │ completed │◀───────────┴───────────┘
                     └───────────┘
```

**Статусы YouTube workflow:**

| Статус | Описание |
|--------|----------|
| `processing` | Начальное состояние, парсинг URL |
| `transcript_fetching` | Получение транскрипта (captions или STT) |
| `transcript_ready` | Транскрипт получен, готов к extraction |
| `extracting` | LLM extraction в процессе |
| `completed` | Успешная обработка |
| `failed` | Ошибка на любом этапе |

**Fallback стратегия для транскриптов:**

1. Human captions (preferred language)
2. Human captions (any language)
3. Auto-generated captions (preferred language)
4. Auto-generated captions (any language)
5. OpenAI Whisper STT (audio download + transcription)

**Кэширование:**
- Транскрипты кэшируются по `videoId`
- Повторные inspiration для того же видео используют кэш
- Сокращение API-вызовов к YouTube и OpenAI

### Запуск воркеров

```bash
# Development
npm run worker:dev

# Production
npm run worker
```

### Важные замечания

- Воркеры должны работать в отдельном процессе от API сервера
- Redis должен быть доступен для работы очередей
- Обработка ошибок происходит через `SocialMediaErrorHandler`
- Повторные попытки настраиваются в конфигурации очередей

