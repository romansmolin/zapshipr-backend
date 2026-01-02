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

#### Routes
```typescript
// routes/your-module.routes.ts
export const createYourModuleRouter = (
  logger: ILogger,
  db: NodePgDatabase<typeof schema>
): Router => {
  const router = createRouter()
  
  const repository = new YourModuleRepository(db, logger)
  const service = new YourModuleService(repository, logger)
  const controller = new YourModuleController(service, logger)
  
  router.post('/your-module', asyncHandler(controller.create.bind(controller)))
  
  return router
}
```

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
import { createYourModuleRouter } from './modules/your-module/routes/your-module.routes'

const yourModuleRoutes = createYourModuleRouter(logger, db)
app.use(yourModuleRoutes)
```

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

