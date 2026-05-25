# Руководства

## Создание нового модуля

При добавлении нового функционала следуйте следующей структуре:

### 1. Создайте директорию модуля

```bash
src/modules/your-module/
```

### 2. Добавьте поддиректории и файлы

#### Controllers
```typescript
// controllers/your-module-controller.interface.ts
export interface IYourModuleController {
  create(...): Promise<...>
  getById(...): Promise<...>
}

// controllers/your-module.controller.ts
export class YourModuleController implements IYourModuleController {
  constructor(
    private service: IYourModuleService,
    private logger: ILogger
  ) {}
  
  async create(req: Request, res: Response) {
    // ...
  }
}
```

#### Services
```typescript
// services/your-module-service.interface.ts
export interface IYourModuleService {
  create(...): Promise<...>
}

// services/your-module.service.ts
export class YourModuleService implements IYourModuleService {
  constructor(
    private repository: IYourModuleRepository,
    private logger: ILogger
  ) {}
}
```

#### Repositories
```typescript
// repositories/your-module-repository.interface.ts
export interface IYourModuleRepository {
  create(...): Promise<...>
}

// repositories/your-module.repository.ts
export class YourModuleRepository implements IYourModuleRepository {
  constructor(
    private db: NodePgDatabase<typeof schema>,
    private logger: ILogger
  ) {}
}
```

#### Routes (СТРОГО — паттерн `build<Name>Module` + композиционный корень)

См. `docs/02-architecture.md` раздел "Композиционный корень" — это обязательная схема.

**Шаг A. Зарегистрируй сервис в `src/composition-root.ts`:**

```typescript
// Внутри buildAppDeps(...)
const yourModuleRepository = new YourModuleRepository(db, logger)
const yourModuleService = new YourModuleService(yourModuleRepository, logger)

// В возвращаемом объекте:
return { /* ... */, yourModuleService }

// В интерфейсе AppDeps:
export interface AppDeps {
  // ...
  yourModuleService: IYourModuleService
}
```

**Шаг B. Создай `routes/your-module.routes.ts`:**

```typescript
import { Router as createRouter } from 'express'
import type { Router } from 'express'

import { bindController } from '@/shared/http/bind-controller'
import { authMiddleware } from '@/middleware/auth.middleware'

import { YourModuleController } from '../controllers/your-module.controller'

import type { IYourModuleService } from '../services/your-module-service.interface'
import type { ILogger } from '@/shared/logger/logger.interface'

export interface YourModuleDeps {
  logger: ILogger
  yourModuleService: IYourModuleService
}

export interface YourModule {
  router: Router
}

export const buildYourModule = ({ logger, yourModuleService }: YourModuleDeps): YourModule => {
  const router = createRouter()
  const controller = new YourModuleController(yourModuleService, logger)
  const handler = bindController(controller)

  router.post('/your-module', authMiddleware, handler('create'))

  return { router }
}
```

**Чек-лист перед PR:**
- [ ] Сервис добавлен в `composition-root.ts` и в интерфейс `AppDeps`
- [ ] В `*.routes.ts` НЕТ `new <Service>(...)`, `new <Repository>(...)` — только контроллер
- [ ] Функция называется `build<Name>Module`, не `create<X>Router`
- [ ] Принимает объект `{ ... }`, а не позиционные аргументы
- [ ] Возвращает `{ router }`, а не голый `Router`
- [ ] Используется `bindController(...)`, а не `.bind(controller)`
- [ ] Экспортируются интерфейсы `<Name>ModuleDeps` и `<Name>Module`

#### Entity (если нужны таблицы)
```typescript
// entity/your-module.schema.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

export const yourModuleTable = pgTable('your_module', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})
```

#### Validation
```typescript
// validation/your-module.schemas.ts
import { z } from 'zod'

export const createYourModuleSchema = z.object({
  name: z.string().min(1),
})
```

### 3. Зарегистрируйте роутер

В `src/server.ts`:
```typescript
import { buildYourModule } from './modules/your-module/routes/your-module.routes'

const deps = buildAppDeps({ db, logger })
const { router: yourModuleRoutes } = buildYourModule({
  logger,
  yourModuleService: deps.yourModuleService,
})
app.use(yourModuleRoutes)
```

Никаких `new` для сервисов в `server.ts` — всё уже построено внутри `buildAppDeps`.

### 4. Экспортируйте схемы (если есть таблицы)

В `src/db/schema.ts`:
```typescript
import { yourModuleTable } from '@/modules/your-module/entity/your-module.schema'

export const schema = {
  // ... существующие схемы
  yourModule: yourModuleTable,
}
```

## Добавление новой социальной платформы

### 1. Создайте коннектор

В `src/modules/social/connectors/{platform}-connector-service/`:

```typescript
// {platform}-connector-service.interface.ts
export interface I{Platform}ConnectorService {
  connect(code: string, userId: string): Promise<SocialAccount>
  refreshToken(accountId: string): Promise<void>
  disconnect(accountId: string): Promise<void>
}

// {platform}-connector.service.ts
export class {Platform}ConnectorService implements I{Platform}ConnectorService {
  constructor(
    private logger: ILogger,
    private httpClient: IApiClient,
    private mediaUploader: IMediaUploader,
    private accountRepository: IAccountRepository,
    private accountService: IAccountsService
  ) {}
  
  async connect(code: string, userId: string) {
    // OAuth flow
  }
}
```

### 2. Создайте паблишер

В `src/modules/social/publishers/{platform}-content-publisher/`:

```typescript
// {platform}-content-publisher.interface.ts
export interface I{Platform}ContentPublisher {
  publish(post: Post, account: SocialAccount, media: MediaAsset[]): Promise<void>
}

// {platform}-content-publisher.ts
export class {Platform}ContentPublisher implements I{Platform}ContentPublisher {
  constructor(
    private logger: ILogger,
    private httpClient: IApiClient,
    private mediaUploader: IMediaUploader
  ) {}
  
  async publish(post: Post, account: SocialAccount, media: MediaAsset[]) {
    // Публикация на платформу
  }
}
```

### 3. Добавьте платформу в enum

В `src/modules/post/schemas/posts.schemas.ts`:
```typescript
export enum SocilaMediaPlatform {
  // ... существующие
  NEW_PLATFORM = 'new_platform',
}
```

### 4. Обновите фабрики

В `src/modules/social/factories/social-media-connector.factory.ts`:
```typescript
import { INewPlatformConnectorService } from '../connectors/new-platform-connector-service/...'
import { NewPlatformConnectorService } from '../connectors/new-platform-connector-service/...'

// В конструкторе
this.newPlatformConnectorService = new NewPlatformConnectorService(...)

// В методе create
case SocilaMediaPlatform.NEW_PLATFORM:
  return this.newPlatformConnectorService
```

Аналогично обновите `SocialMediaPublisherFactory`.

### 5. Проверьте совместимость медиа

Убедитесь, что в логике проверки совместимости медиа учтены ограничения новой платформы (форматы, размеры, длительность видео).
