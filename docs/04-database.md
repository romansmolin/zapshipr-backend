# Работа с базой данных

## Drizzle ORM

Проект использует Drizzle ORM для работы с PostgreSQL.

### Организация схем

- Все схемы определены в `src/modules/*/entity/*.schema.ts`
- Централизованный экспорт в `src/db/schema.ts`
- Миграции в `src/db/migrations/`
- Типизированный клиент: `NodePgDatabase<typeof schema>`

### Пример использования

```typescript
import { db } from '@/db/client'
import { users } from '@/db/schema'

// Типизированные запросы
const user = await db.select().from(users).where(eq(users.id, userId))
```

## Основные таблицы

### `users`
Хранит информацию о пользователях:
- id, email, name, password (hashed)
- created_at, updated_at

### `workspaces`
Рабочие пространства пользователей:
- id, userId, name
- description (опционально)
- avatarUrl (опционально)
- created_at, updated_at

### `socialAccounts`
Подключенные аккаунты социальных сетей:
- id, userId, workspaceId, platform
- accessToken (encrypted), refreshToken
- expiresAt, accountId (ID на платформе)
- username, avatarUrl

### `posts`
Посты пользователей:
- id, userId, workspaceId, content
- scheduledAt (опционально)
- status (pending, published, failed)
- created_at, updated_at

### `postTargets`
Связь постов с аккаунтами (цели публикации):
- id, postId, socialAccountId
- status, publishedAt
- errorMessage (если публикация failed)

### `mediaAssets`
Медиа-файлы:
- id, url (S3 URL)
- type (image/video)
- size, mimeType
- created_at

### `postMediaAssets`
Связь постов с медиа-файлами:
- postId, mediaAssetId
- order (порядок в посте)

### `pinterestBoards`
Доски Pinterest:
- id, socialAccountId
- boardId, name, url

### `waitlistEntries`
Записи waitlist:
- id, email, referralCode
- referredBy (опционально)
- created_at

### `waitlistReferralEvents`
События реферальной программы

### `waitlistReferralRewards`
Награды за рефералов

