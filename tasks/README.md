# Tasks Directory

Эта папка содержит технические задания и чек-листы для реализации фич ZapShipr Backend.

---

## 📋 Inspirations System

Система обучения контента на основе вдохновений пользователя.

### Документы:

1. **[inspirations-system.md](./inspirations-system.md)** — Полное техническое задание
   - Бизнес-логика и user workflow
   - Структура базы данных (схемы таблиц)
   - API endpoints с примерами запросов/ответов
   - Сервисы и модули
   - Миграции БД
   - Зависимости и npm пакеты
   - Этапы реализации (Phase 1-5)
   - Security, валидация, error handling

2. **[inspirations-checklist.md](./inspirations-checklist.md)** — Чек-лист реализации
   - Разбивка по фазам
   - Детальный список задач с чекбоксами
   - Оценка времени (2-3 недели)
   - Приоритеты (High/Medium/Low)

3. **[inspirations-architecture.md](./inspirations-architecture.md)** — Архитектурная диаграмма
   - Визуализация системы (ASCII диаграммы)
   - Data flow: создание inspiration step-by-step
   - Связи между таблицами БД
   - Структура Main Prompt
   - Логика работы Workspace Tags
   - Security considerations
   - Performance optimizations

---

## 🚀 Quick Start

### Phase 1: Raw Inspirations CRUD (3-4 дня)
Начните с:
1. Миграции БД (`rawInspirations`, `inspirationsExtractions`, `workspaceTags`)
2. Entity schemas (Drizzle)
3. Repositories
4. CRUD endpoints

### Phase 2: LLM Integration (5-7 дней)
Затем:
1. Content parsing (HTML, PDF, DOCX, YouTube)
2. OpenAI integration
3. BullMQ worker для асинхронной обработки

### Phase 3: Workspace Tags (2-3 дня)
1. CRUD для тегов
2. Автоматическая синхронизация из extractions

### Phase 4: Main Prompt (1-2 дня)
1. Добавление поля mainPrompt в workspaces
2. Endpoints для чтения/обновления

---

## 📊 Status

- ⏳ **Phase 1**: Not started
- ⏳ **Phase 2**: Not started
- ⏳ **Phase 3**: Not started
- ⏳ **Phase 4**: Not started

**Total progress**: 0% (0/4 phases complete)

---

## 🔗 Related Documentation

- [Project Overview](../docs/01-overview.md)
- [Architecture](../docs/02-architecture.md)
- [Modules](../docs/03-modules.md)
- [Database](../docs/04-database.md)
- [Queues & Workers](../docs/05-queues-workers.md)

---

## 💡 Key Decisions

| Question | Decision |
|----------|----------|
| Дубликаты ссылок | ✅ Блокировать (unique constraint) |
| Content parsing limit | ✅ 1500 слов |
| LLM модель | ✅ OpenAI GPT-4o (or gpt-4o-mini) |
| Background processing | ✅ BullMQ queue |
| Tag categorization | ✅ Эвристика (без доп. LLM) |
| Main Prompt | ✅ Структурированный JSONB |
| File size limit | ✅ 50MB |

---

## 📝 Notes

- **Priority**: High (MVP feature)
- **Estimated Time**: 2-3 weeks
- **Dependencies**: OpenAI API, AWS S3, BullMQ
- **New npm packages**: cheerio, pdf-parse, mammoth, openai, file-type

---

**Last Updated**: 2025-01-02

