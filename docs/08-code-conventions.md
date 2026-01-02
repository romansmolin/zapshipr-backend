# Конвенции кода

## Именование

### Файлы
- **Формат**: kebab-case
- **Примеры**: `auth.controller.ts`, `user-repository.interface.ts`

### Классы
- **Формат**: PascalCase
- **Примеры**: `AuthController`, `UserRepository`, `PostsService`

### Интерфейсы
- **Формат**: PascalCase с префиксом `I`
- **Примеры**: `IAuthService`, `IPostsService`, `IAccountRepository`

### Функции и переменные
- **Формат**: camelCase
- **Примеры**: `signUp`, `getUserById`, `createPost`

### Константы
- **Формат**: UPPER_SNAKE_CASE
- **Примеры**: `JWT_SECRET`, `MAX_FILE_SIZE`, `ERROR_CODES`

## Импорты

### Path Aliases
Используются path aliases для упрощения импортов:
```typescript
import { db } from '@/db/client'
import { ILogger } from '@/shared/logger'
import { AuthService } from '@/modules/auth/services/auth.service'
```

### Группировка
Импорты группируются в следующем порядке:
1. Внешние библиотеки (express, zod, и т.д.)
2. Внутренние модули через `@/`
3. Относительные импорты (если нужны)

### Сортировка
Автоматическая сортировка через `@trivago/prettier-plugin-sort-imports`

## Типизация

### Строгая типизация
- TypeScript настроен с `strict: true`
- Все функции должны быть типизированы
- Избегайте использования `any`

### Типы vs Интерфейсы
- **`type`**: Для типов данных, union types, utility types
- **`interface`**: Для контрактов классов и объектов, которые могут расширяться

```typescript
// type для данных
type PostStatus = 'pending' | 'published' | 'failed'

// interface для контрактов
interface IPostsService {
  createPost(...): Promise<CreatePostResponse>
}
```

## Валидация

### Zod схемы
- Все схемы валидации в директориях `validation/`
- Именование: `{module}.schemas.ts` (например, `auth.schemas.ts`)

### Использование
```typescript
import { z } from 'zod'

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1)
})
```

### Автоматический маппинг ошибок
Ошибки Zod автоматически преобразуются в формат API через `error-handler.ts`

## Обработка ошибок

### Async Handler
Всегда используйте `asyncHandler` для async роутов:
```typescript
router.post('/posts', asyncHandler(controller.createPost.bind(controller)))
```

### Типы ошибок
- **`AppError`**: Кастомные ошибки приложения с кодами
- **`BaseAppError`**: Базовый класс для ошибок
- **`ZodError`**: Автоматически обрабатывается

### Бросание ошибок
```typescript
throw new AppError('User not found', ErrorMessageCode.NOT_FOUND, 404)
```

## Логирование

### Интерфейс ILogger
Все сервисы и репозитории получают logger через конструктор:
```typescript
class PostsService {
  constructor(
    private repository: IPostsRepository,
    private logger: ILogger
  ) {}
}
```

### Уровни логирования
- `logger.info()` — информационные сообщения
- `logger.error()` — ошибки
- `logger.warn()` — предупреждения
- `logger.debug()` — отладочная информация

### Структурированное логирование
```typescript
logger.error('Request failed', {
  operation: `${req.method} ${req.originalUrl}`,
  error: formatError(error),
  userId: req.user?.id
})
```

## Структура модулей

Каждый модуль должен следовать единой структуре:
```
module/
├── controllers/
│   ├── module.controller.ts
│   └── module-controller.interface.ts
├── services/
│   ├── module.service.ts
│   └── module-service.interface.ts
├── repositories/
│   ├── module.repository.ts
│   └── module-repository.interface.ts
├── routes/
│   └── module.routes.ts
├── entity/
│   └── module.schema.ts
├── validation/
│   └── module.schemas.ts
└── use-cases/ (опционально)
```

