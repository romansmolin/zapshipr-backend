# Workspace Module

Модуль для управления рабочими пространствами (workspaces).

## Назначение

Workspace — это рабочее пространство пользователя, к которому привязаны посты и аккаунты социальных сетей. Это позволяет пользователям организовывать свою работу по разным проектам или клиентам.

## Структура

```
workspace/
├── controllers/
│   ├── workspace.controller.ts
│   └── workspace-controller.interface.ts
├── services/
│   ├── workspace.service.ts
│   └── workspace-service.interface.ts
├── repositories/
│   ├── workspace.repository.ts
│   └── workspace-repository.interface.ts
├── routes/
│   └── workspace.routes.ts
├── entity/
│   ├── workspace.schema.ts
│   └── workspace.dto.ts
└── validation/
    └── workspace.schemas.ts
```

## API Endpoints

### POST /workspaces

Создание нового workspace.

**Request Body:**

```json
{
    "name": "My Project",
    "description": "Project description (optional)"
}
```

**Response:**

```json
{
    "id": "uuid",
    "userId": "uuid",
    "name": "My Project",
    "description": "Project description",
    "avatarUrl": null,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
}
```

### GET /workspaces

Получение списка всех workspace пользователя.

**Response:**

```json
[
    {
        "id": "uuid",
        "userId": "uuid",
        "name": "My Project",
        "description": "Project description",
        "avatarUrl": "https://...",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
    }
]
```

### GET /workspaces/:id

Получение workspace по ID.

### PUT /workspaces/:id

Обновление workspace.

**Request Body:**

```json
{
    "name": "Updated Name (optional)",
    "description": "Updated description (optional)"
}
```

### DELETE /workspaces/:id

Удаление workspace. **Внимание:** удаляет все связанные посты и аккаунты!

### POST /workspaces/:id/avatar

Загрузка аватарки для workspace.

**Request:** multipart/form-data с полем `avatar`

## Связи с другими модулями

### Posts

Каждый пост привязан к workspace через `workspaceId`. При фильтрации постов можно указать `workspaceId` для получения постов конкретного workspace.

### Social Accounts

Каждый подключенный аккаунт социальной сети привязан к workspace. При получении списка аккаунтов можно фильтровать по `workspaceId`.

## Cascade удаление

При удалении workspace автоматически удаляются:

- Все посты этого workspace
- Все аккаунты социальных сетей этого workspace
- Все связанные медиа-файлы

## Использование

### Создание workspace

```typescript
const workspace = await workspaceService.create(userId, {
    name: 'My Project',
    description: 'Project for client X',
})
```

### Фильтрация постов по workspace

```typescript
const posts = await postsService.getPostsByFilters(userId, {
    workspaceId: 'workspace-uuid',
    status: PostStatus.PUBLISHED,
})
```

### Фильтрация аккаунтов по workspace

```typescript
const accounts = await accountsService.getAllAccounts(userId, 'workspace-uuid')
```
