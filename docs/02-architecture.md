# Архитектура проекта

## Структура директорий

```
src/
├── app.ts                    # Создание Express приложения
├── server.ts                 # Точка входа для API сервера
├── worker.ts                 # Точка входа для worker процессов
├── db/                       # Работа с базой данных
│   ├── client.ts            # Drizzle клиент
│   ├── schema.ts            # Экспорт всех схем
│   └── migrations/          # Миграции БД
├── modules/                  # Бизнес-логика по модулям
│   ├── auth/                # Аутентификация
│   ├── user/                # Управление пользователями
│   ├── workspace/           # Управление workspace
│   ├── post/                # Управление постами
│   ├── social/              # Интеграции с соцсетями
│   ├── ai/                  # AI функциональность
│   ├── email/               # Email сервисы
│   └── waitlist/            # Waitlist функциональность
├── middleware/              # Express middleware
│   ├── auth.middleware.ts   # JWT аутентификация
│   └── upload.middleware.ts # Загрузка файлов
└── shared/                  # Общие утилиты и сервисы
    ├── errors/              # Обработка ошибок
    ├── http/                # HTTP утилиты
    ├── http-client/         # HTTP клиент
    ├── logger/              # Логирование
    ├── media-uploader/      # Загрузка медиа в S3
    ├── image-processor/     # Обработка изображений
    ├── video-processor/     # Обработка видео
    ├── queue/               # BullMQ конфигурация
    └── social-media-errors/ # Обработка ошибок соцсетей
```

## Паттерны архитектуры

### 1. Модульная архитектура

Каждый модуль (`auth`, `post`, `social`, и т.д.) следует единой структуре:
- `controllers/` — обработчики HTTP запросов
- `services/` — бизнес-логика (с интерфейсами `*.interface.ts`)
- `repositories/` — доступ к данным (с интерфейсами `*.interface.ts`)
- `routes/` — определение маршрутов Express
- `entity/` — схемы данных и DTO
- `validation/` — Zod схемы для валидации
- `use-cases/` — отдельные use cases (опционально)

### 2. Dependency Injection через конструкторы

Все зависимости передаются через конструкторы, что упрощает тестирование:

```typescript
// Пример из auth.routes.ts
const userRepository = new UserRepository(db, logger)
const authService = new AuthService(userRepository, logger)
const authController = new AuthController(authService, logger)
```

### 3. Интерфейсы для всех сервисов и репозиториев

Каждый сервис и репозиторий имеет интерфейс:
- `IAuthService`, `IPostsService`, `IAccountRepository` и т.д.
- Реализации следуют этим интерфейсам

### 4. Factory Pattern

Используется для создания платформо-специфичных сервисов:
- `SocialMediaConnectorFactory` — создает коннекторы для разных соцсетей
- `SocialMediaPublisherFactory` — создает паблишеры для разных платформ

### 5. Error Handling

- `AppError` — кастомные ошибки приложения
- `BaseAppError` — базовый класс для ошибок
- Централизованный обработчик ошибок в `error-handler.ts`
- Поддержка Zod валидации с автоматическим маппингом ошибок

