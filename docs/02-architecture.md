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

### 2a. Композиционный корень (СТРОГО)

Все сервисы, репозитории и общая инфраструктура собираются ровно один раз в `src/composition-root.ts` — функция `buildAppDeps({ db, logger })` возвращает типизированный объект `AppDeps`. Это ЕДИНСТВЕННОЕ место, где конструируются singleton-зависимости приложения.

**Правила:**

1. **Один корень** — `src/composition-root.ts` владеет графом зависимостей. Любой новый сервис добавляется туда, а не в `*.routes.ts`.
2. **Никаких `new ServiceX()` вне корня** — модули НЕ конструируют свои сервисы. Они получают готовые через deps.
3. **Точка входа** — `server.ts` и `worker.ts` вызывают `buildAppDeps({ db, logger })` и передают нужный срез в каждый `build<Name>Module(...)`.
4. **Полная типизация** — `AppDeps` явно перечисляет все доступные singletons с типами через интерфейсы (где они есть).

### 2b. Композиция модулей (СТРОГО)

Каждый модуль ОБЯЗАН экспортировать функцию `build<Name>Module(deps): { router }` из своего `*.routes.ts` файла. Это тонкий слой: он строит ТОЛЬКО контроллер и маршруты, всё остальное приходит через deps из композиционного корня.

**Правила:**

1. **Имя функции** — `build<Name>Module` (например, `buildAuthModule`, `buildPostsModule`). Никаких `createXRouter`.
2. **Сигнатура** — принимает один объект с именованными зависимостями, возвращает `{ router }`. Никаких позиционных аргументов.
3. **Типы** — каждый модуль экспортирует `<Name>ModuleDeps` и `<Name>Module` интерфейсы.
4. **Содержимое функции** — только построение контроллера + маршруты. Никаких репозиториев, сервисов, факторий, use-case'ов внутри.
5. **Привязка контроллера** — для каждого контроллера используется `bindController` из `@/shared/http/bind-controller`. Никаких `.bind(controller)` вручную.

**Канонический пример модуля:**

```typescript
// src/modules/auth/routes/auth.routes.ts
export interface AuthModuleDeps {
    logger: ILogger
    authService: IAuthService
}

export interface AuthModule {
    router: Router
}

export const buildAuthModule = ({ logger, authService }: AuthModuleDeps): AuthModule => {
    const authController = new AuthController(authService, logger)
    const router = createRouter()
    const handler = bindController(authController)

    router.post('/auth/sign-up', handler('signUp'))
    router.post('/auth/sign-in', handler('signIn'))
    // ...

    return { router }
}
```

**Канонический пример композиционного корня:**

```typescript
// src/composition-root.ts
export interface AppDeps {
    db: NodePgDatabase<typeof dbSchema>
    logger: ILogger
    // infra, repositories, services...
    authService: IAuthService
    postsService: IPostsService
    // ...
}

export const buildAppDeps = ({ db, logger }: AppDepsInput): AppDeps => {
    const emailService = new NodemailerEmailService(logger)
    const userRepository = new UserRepository(db, logger)
    const authService = new AuthService(userRepository, emailService, logger)
    // ... все остальные сервисы
    return { db, logger, authService, /* ... */ }
}
```

**Использование в `server.ts`:**

```typescript
const deps = buildAppDeps({ db, logger })
const { router: authRoutes } = buildAuthModule({ logger, authService: deps.authService })
app.use(authRoutes)
```

**Что НЕЛЬЗЯ делать:**

- ❌ Не создавать сервисы, репозитории или общую инфраструктуру внутри `*.routes.ts` — всё это живёт в `composition-root.ts`.
- ❌ Не использовать `.bind(controller)` напрямую — только через `bindController(...)`.
- ❌ Не делать сигнатуру с позиционными аргументами `(logger, db, ...)` — только объект `{ ... }`.
- ❌ Не возвращать голый `Router` — только `{ router }`.
- ❌ Не создавать партиальные/noop-версии сервисов в роутах для покрытия "только нужных методов" — если форма сервиса не подходит, разбей сервис, а не моки.

**При добавлении нового сервиса:**
1. Сконструируй его в `buildAppDeps` (`composition-root.ts`).
2. Добавь поле в интерфейс `AppDeps`.
3. Если он нужен новому модулю — добавь поле в `<Name>ModuleDeps` и передай из `server.ts`.

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

