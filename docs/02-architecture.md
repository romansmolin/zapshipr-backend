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

Все зависимости передаются через конструкторы, что упрощает тестирование.

### 2a. Композиция модулей (СТРОГО)

Каждый модуль ОБЯЗАН экспортировать функцию `build<Name>Module(deps): { router }` из своего `*.routes.ts` файла. Эта функция — единственная точка входа в модуль и единственное место, где собираются его зависимости.

**Правила:**

1. **Имя функции** — `build<Name>Module` (например, `buildAuthModule`, `buildPostsModule`). Никаких `createXRouter`.
2. **Сигнатура** — принимает один объект с именованными зависимостями, возвращает `{ router }`. Никаких позиционных аргументов.
3. **Типы** — каждый модуль экспортирует `<Name>ModuleDeps` и `<Name>Module` интерфейсы.
4. **Внешние зависимости** — `db` и `logger` всегда передаются. Общая инфраструктура (`mediaUploader`, `apiClient`, `emailService`, готовые сервисы вроде `aiService`) тоже передаётся снаружи — НЕ создаётся внутри модуля.
5. **Внутренние зависимости** — репозитории и сервисы самого модуля собираются ВНУТРИ функции `build<Name>Module`. Это локальная сборка графа.
6. **Привязка контроллера** — для каждого контроллера используется `bindController` из `@/shared/http/bind-controller`. Никаких `.bind(controller)` вручную.
7. **Композиционный корень** — `src/server.ts` создаёт shared singletons один раз и передаёт их в каждый `build<Name>Module`. Воркеры (`src/worker.ts`) поступают аналогично для своих нужд.

**Канонический пример:**

```typescript
// src/modules/auth/routes/auth.routes.ts
export interface AuthModuleDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    emailService: IEmailService
}

export interface AuthModule {
    router: Router
}

export const buildAuthModule = ({ db, logger, emailService }: AuthModuleDeps): AuthModule => {
    const userRepository = new UserRepository(db, logger)
    const authService = new AuthService(userRepository, emailService, logger)
    const authController = new AuthController(authService, logger)

    const router = createRouter()
    const handler = bindController(authController)

    router.post('/auth/sign-up', handler('signUp'))
    router.post('/auth/sign-in', handler('signIn'))
    // ...

    return { router }
}
```

**Использование в `server.ts`:**

```typescript
const emailService = new NodemailerEmailService(logger)
const { router: authRoutes } = buildAuthModule({ db, logger, emailService })
app.use(authRoutes)
```

**Что НЕЛЬЗЯ делать:**

- ❌ Не создавать общую инфраструктуру (`S3Uploader`, `AxiosHttpClient`, `NodemailerEmailService`) внутри модуля — она должна приходить через `deps`.
- ❌ Не использовать `.bind(controller)` напрямую — только через `bindController(...)`.
- ❌ Не делать сигнатуру с позиционными аргументами `(logger, db, ...)` — только объект `{ ... }`.
- ❌ Не возвращать голый `Router` — только `{ router }` (это оставляет место для будущего экспорта внутренних сервисов).

**При добавлении нового модуля:** строго следуй этой схеме. Никаких исключений.

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

