# Frontend: Onboarding & First Workspace Creation

## Overview

Реализация онбординга и создания первого workspace для новых пользователей ZapShipr. Цель — обеспечить плавное знакомство пользователя с платформой и быстрый старт работы.

---

## User Flow

```
1. Регистрация/Вход → 2. Приветственный экран → 3. Создание Workspace → 4. Dashboard
```

### Детальный Flow:

1. **Регистрация/Вход** (уже реализовано на бэкенде)
   - Google OAuth
   - Email + Password

2. **Приветственный экран** (Welcome Screen)
   - Показывается только при первом входе
   - Краткое описание возможностей платформы
   - CTA: "Создать мой первый Workspace"

3. **Создание Workspace**
   - Форма с полями:
     - Название workspace (обязательно)
     - Описание workspace (опционально)
     - Аватар workspace (опционально, можно загрузить позже)
   - Валидация
   - Создание через API

4. **Redirect на Dashboard**
   - После успешного создания → переход на главную страницу
   - Показать toast notification с успехом

---

## 1. Welcome Screen

### UI/UX Requirements

**Layout:**
- Центрированный контент
- Логотип ZapShipr вверху
- Hero секция с заголовком и описанием
- 3 ключевых преимущества (cards)
- CTA button внизу

**Content:**

```
Заголовок: "Добро пожаловать в ZapShipr! 🚀"

Подзаголовок: "Управляй контентом для всех социальных сетей из одного места"

Преимущества:
1. 📅 "Планируй публикации"
   - Создавай и планируй посты на неделю вперед

2. 🤖 "Используй AI"
   - Генерируй контент с помощью искусственного интеллекта

3. 📊 "Анализируй результаты"
   - Отслеживай эффективность своих публикаций

CTA: "Создать мой первый Workspace" (primary button)
```

**Visual Style:**
- Минималистичный, современный дизайн
- Использовать brand colors
- Легкая анимация появления элементов (fade-in)
- Responsive для всех устройств

**Technical:**
- Component: `WelcomeScreen.tsx`
- Route: `/welcome` (redirect after first login)
- State management: проверка, был ли пользователь уже на этом экране
  - Можно хранить в localStorage: `hasSeenWelcome: true`
  - Или через API: флаг в профиле пользователя

---

## 2. Create Workspace Form

### UI/UX Requirements

**Layout:**
- Modal или отдельная страница (рекомендую modal)
- Заголовок: "Создай свой Workspace"
- Форма с полями
- Кнопки: "Отмена" (secondary) и "Создать" (primary)

**Form Fields:**

1. **Название Workspace** (обязательно)
   - Label: "Название"
   - Placeholder: "Мой блог", "Instagram бизнеса", "Личный бренд"
   - Type: text input
   - Validation:
     - Обязательное поле
     - Минимум 1 символ
     - Максимум 255 символов
   - Error messages:
     - "Введите название workspace"
     - "Название слишком длинное (макс. 255 символов)"

2. **Описание Workspace** (опционально)
   - Label: "Описание" (optional)
   - Placeholder: "Для чего будет использоваться этот workspace?"
   - Type: textarea (2-3 строки)
   - Validation:
     - Не обязательное
     - Максимум 500 символов
   - Error message:
     - "Описание слишком длинное (макс. 500 символов)"

3. **Аватар Workspace** (опционально, можно пропустить)
   - Label: "Аватар" (optional)
   - UI: Upload area с drag & drop или button "Выбрать файл"
   - Preview uploaded image
   - Validation:
     - Форматы: JPG, PNG, WebP
     - Максимальный размер: 5MB
   - Error messages:
     - "Неподдерживаемый формат (используйте JPG, PNG или WebP)"
     - "Файл слишком большой (макс. 5MB)"
   - Note: "Вы сможете добавить аватар позже в настройках"

**Form Behavior:**

- Real-time validation (показывать ошибки при blur или при попытке submit)
- Disabled submit button, если есть ошибки валидации
- Loading state при отправке
- Toast notification при успехе/ошибке

**Technical:**
- Component: `CreateWorkspaceModal.tsx` или `CreateWorkspaceForm.tsx`
- Form library: React Hook Form + Zod (рекомендую)
- File upload: через API `/workspaces/:id/avatar` (PUT) после создания workspace
- State management: local state или form state

---

## 3. API Integration

### Backend Endpoints

#### 1. Create Workspace

```http
POST /workspaces
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "name": "Мой блог",
  "description": "Workspace для моего личного блога"
}

Response: 201 Created
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Мой блог",
  "description": "Workspace для моего личного блога",
  "avatarUrl": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}

Errors:
- 400 Bad Request: Validation error
- 401 Unauthorized: Invalid token
- 500 Internal Server Error
```

#### 2. Upload Workspace Avatar (опционально)

```http
POST /workspaces/:id/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request Body:
{
  "avatar": <file>
}

Response: 200 OK
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Мой блог",
  "description": "...",
  "avatarUrl": "https://s3.amazonaws.com/zapshipr/workspaces/uuid/avatar.jpg",
  "createdAt": "...",
  "updatedAt": "..."
}

Errors:
- 400 Bad Request: Invalid file format or size
- 401 Unauthorized
- 403 Forbidden: Not your workspace
- 404 Not Found: Workspace not found
- 415 Unsupported Media Type
- 500 Internal Server Error
```

#### 3. Get User Workspaces

```http
GET /workspaces
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "Мой блог",
    "description": "...",
    "avatarUrl": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
]

Errors:
- 401 Unauthorized
- 500 Internal Server Error
```

### API Client

**Рекомендуемый подход:**

```typescript
// api/workspaces.ts
import { apiClient } from './client'

export interface CreateWorkspaceDto {
  name: string
  description?: string
}

export interface WorkspaceDto {
  id: string
  userId: string
  name: string
  description: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export const workspacesApi = {
  create: async (data: CreateWorkspaceDto): Promise<WorkspaceDto> => {
    const response = await apiClient.post('/workspaces', data)
    return response.data
  },

  uploadAvatar: async (workspaceId: string, file: File): Promise<WorkspaceDto> => {
    const formData = new FormData()
    formData.append('avatar', file)
    
    const response = await apiClient.post(
      `/workspaces/${workspaceId}/avatar`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  getAll: async (): Promise<WorkspaceDto[]> => {
    const response = await apiClient.get('/workspaces')
    return response.data
  },
}
```

---

## 4. State Management

### User State

```typescript
interface UserState {
  user: User | null
  isAuthenticated: boolean
  hasSeenWelcome: boolean
  currentWorkspace: WorkspaceDto | null
  workspaces: WorkspaceDto[]
}

// Actions
- setUser(user: User)
- setHasSeenWelcome(value: boolean)
- setCurrentWorkspace(workspace: WorkspaceDto)
- addWorkspace(workspace: WorkspaceDto)
```

### Recommendations:

- **Zustand** (простой, легковесный) или
- **Redux Toolkit** (если уже используется в проекте) или
- **React Context** (для простых случаев)

---

## 5. Routing & Navigation

### Routes

```typescript
const routes = [
  {
    path: '/login',
    component: LoginPage,
    public: true,
  },
  {
    path: '/register',
    component: RegisterPage,
    public: true,
  },
  {
    path: '/welcome',
    component: WelcomeScreen,
    protected: true,
    requiresNoWorkspace: true, // показывать только если нет workspace
  },
  {
    path: '/dashboard',
    component: Dashboard,
    protected: true,
    requiresWorkspace: true, // redirect на /welcome если нет workspace
  },
  // ... other routes
]
```

### Navigation Logic

После успешного логина:
1. Проверить, есть ли у пользователя workspaces
2. Если НЕТ → redirect на `/welcome`
3. Если ЕСТЬ → redirect на `/dashboard`

После создания первого workspace:
1. Сохранить workspace в state
2. Установить как `currentWorkspace`
3. Redirect на `/dashboard`
4. Показать success toast

---

## 6. Components Structure

```
src/
├── components/
│   ├── onboarding/
│   │   ├── WelcomeScreen.tsx
│   │   ├── CreateWorkspaceModal.tsx
│   │   ├── CreateWorkspaceForm.tsx
│   │   ├── FeatureCard.tsx
│   │   └── index.ts
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── FileUpload.tsx
│   │   ├── Toast.tsx
│   │   └── Modal.tsx
│   └── layout/
│       ├── AuthLayout.tsx
│       └── DashboardLayout.tsx
├── pages/
│   ├── WelcomePage.tsx
│   ├── DashboardPage.tsx
│   └── ...
├── hooks/
│   ├── useCreateWorkspace.ts
│   ├── useAuth.ts
│   └── useWorkspaces.ts
├── api/
│   ├── client.ts
│   ├── workspaces.ts
│   └── auth.ts
├── store/
│   ├── userStore.ts
│   └── workspaceStore.ts
└── types/
    ├── workspace.ts
    └── user.ts
```

---

## 7. Validation Schema (Zod)

```typescript
import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Введите название workspace')
    .max(255, 'Название слишком длинное (макс. 255 символов)'),
  description: z
    .string()
    .max(500, 'Описание слишком длинное (макс. 500 символов)')
    .optional(),
})

export type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>

// File validation (отдельно, так как Zod не поддерживает File напрямую)
export const validateWorkspaceAvatar = (file: File): string | null => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const maxSize = 5 * 1024 * 1024 // 5MB

  if (!allowedTypes.includes(file.type)) {
    return 'Неподдерживаемый формат (используйте JPG, PNG или WebP)'
  }

  if (file.size > maxSize) {
    return 'Файл слишком большой (макс. 5MB)'
  }

  return null
}
```

---

## 8. Error Handling

### Error Types

1. **Validation Errors** (client-side)
   - Показывать под соответствующим полем
   - Красный цвет, иконка ошибки

2. **API Errors** (server-side)
   - 400 Bad Request → показать specific validation errors
   - 401 Unauthorized → redirect на login
   - 403 Forbidden → показать access denied message
   - 500 Internal Server Error → показать generic error message

3. **Network Errors**
   - Показать toast: "Проблема с сетью. Проверьте подключение."
   - Retry button (опционально)

### Error Messages

```typescript
const errorMessages = {
  network: 'Проблема с сетью. Проверьте подключение к интернету.',
  unauthorized: 'Сессия истекла. Пожалуйста, войдите снова.',
  forbidden: 'У вас нет прав для выполнения этого действия.',
  serverError: 'Что-то пошло не так. Попробуйте еще раз позже.',
  workspaceCreateFailed: 'Не удалось создать workspace. Попробуйте еще раз.',
  avatarUploadFailed: 'Не удалось загрузить аватар. Вы сможете добавить его позже.',
}
```

---

## 9. Loading States

### States to Handle

1. **Creating Workspace**
   - Disabled form inputs
   - Loading spinner на кнопке "Создать"
   - Text: "Создание..." вместо "Создать"

2. **Uploading Avatar**
   - Progress bar (опционально)
   - Loading spinner рядом с preview
   - Можно пропустить и создать workspace без аватара

3. **Fetching Workspaces**
   - Skeleton loader на Welcome Screen
   - Не блокировать UI

---

## 10. Success States

### Toast Notifications

```
✅ "Workspace 'Мой блог' успешно создан!"
ℹ️ "Аватар будет загружен в фоновом режиме"
⚠️ "Workspace создан, но аватар не удалось загрузить"
```

---

## 11. Accessibility (a11y)

- [ ] Все интерактивные элементы доступны с клавиатуры (Tab, Enter, Escape)
- [ ] ARIA labels для всех input полей
- [ ] Focus management в modal (trap focus)
- [ ] Screen reader friendly error messages
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Alt text для всех изображений

---

## 12. Responsive Design

### Breakpoints

- **Mobile**: < 640px
  - Stack everything vertically
  - Full-width form
  - Simplified navigation

- **Tablet**: 640px - 1024px
  - 2-column layout for feature cards
  - Modal width: 80%

- **Desktop**: > 1024px
  - 3-column layout for feature cards
  - Modal width: 600px max

---

## 13. Testing Checklist

### Manual Testing

- [ ] Пользователь видит Welcome Screen после первого входа
- [ ] Welcome Screen не показывается при повторном входе
- [ ] Форма создания workspace валидирует поля
- [ ] Можно создать workspace только с названием (без описания/аватара)
- [ ] Можно создать workspace с описанием
- [ ] Можно загрузить аватар (поддерживаемые форматы)
- [ ] Ошибка при загрузке слишком большого файла
- [ ] Ошибка при загрузке неподдерживаемого формата
- [ ] Success toast после успешного создания
- [ ] Redirect на dashboard после создания
- [ ] Workspace появляется в списке пользовательских workspaces
- [ ] Обработка ошибок API
- [ ] Loading states работают корректно
- [ ] Responsive на всех устройствах

### Unit Tests (опционально)

- Form validation logic
- API client methods
- Error handling utilities

### E2E Tests (опционально)

- Complete onboarding flow
- Create workspace with all fields
- Create workspace with minimal fields

---

## 14. Nice-to-Have Features (MVP+)

1. **Skip Avatar Upload**
   - Link: "Пропустить, добавлю позже"
   - Создать workspace сразу без ожидания загрузки

2. **Onboarding Progress**
   - Step indicator: 1/2, 2/2
   - Progress bar

3. **Предложения названий**
   - Показать примеры: "Мой блог", "Instagram бизнеса", "Личный бренд"
   - Quick select button для каждого примера

4. **Preview**
   - Показать preview того, как будет выглядеть workspace card

5. **Keyboard Shortcuts**
   - `Cmd/Ctrl + Enter` для submit формы
   - `Escape` для закрытия modal

6. **Analytics**
   - Track: welcome_screen_viewed
   - Track: workspace_created
   - Track: avatar_uploaded

---

## 15. Timeline & Priorities

### Phase 1: Core MVP (Приоритет 1)
- [ ] Welcome Screen UI
- [ ] Create Workspace Form (без аватара)
- [ ] API Integration (create workspace)
- [ ] Basic validation
- [ ] Success/Error handling
- [ ] Routing & navigation logic

**Estimate**: 2-3 дня

### Phase 2: Polish (Приоритет 2)
- [ ] Avatar upload
- [ ] Improved UX (loading states, animations)
- [ ] Error messages refinement
- [ ] Responsive design
- [ ] Accessibility improvements

**Estimate**: 1-2 дня

### Phase 3: Nice-to-Have (Приоритет 3)
- [ ] Onboarding progress indicator
- [ ] Name suggestions
- [ ] Preview
- [ ] Analytics tracking

**Estimate**: 1 день

---

## 16. Technical Stack Recommendations

- **Framework**: React 18+ (Next.js если SSR нужен)
- **Styling**: Tailwind CSS + Headless UI или Shadcn/ui
- **Forms**: React Hook Form + Zod
- **API Client**: Axios или Fetch API
- **State Management**: Zustand (рекомендую) или Redux Toolkit
- **Routing**: React Router v6
- **Notifications**: React Hot Toast или Sonner
- **File Upload**: react-dropzone (опционально)

---

## 17. Design System

### Colors

```typescript
const colors = {
  primary: {
    50: '#f0f9ff',
    500: '#3b82f6', // Main brand color
    600: '#2563eb',
    700: '#1d4ed8',
  },
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    500: '#6b7280',
    900: '#111827',
  },
}
```

### Typography

```typescript
const typography = {
  h1: 'text-4xl font-bold',
  h2: 'text-3xl font-semibold',
  h3: 'text-2xl font-semibold',
  body: 'text-base',
  small: 'text-sm',
}
```

---

## 18. Example Code Snippets

### CreateWorkspaceForm Component

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createWorkspaceSchema, type CreateWorkspaceFormData } from '@/schemas'
import { workspacesApi } from '@/api'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

export function CreateWorkspaceForm() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
  })

  const onSubmit = async (data: CreateWorkspaceFormData) => {
    try {
      const workspace = await workspacesApi.create(data)
      toast.success(`Workspace '${workspace.name}' успешно создан!`)
      navigate('/dashboard')
    } catch (error) {
      toast.error('Не удалось создать workspace. Попробуйте еще раз.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Название
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          placeholder="Мой блог"
          className="w-full px-3 py-2 border rounded-lg"
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Описание <span className="text-gray-500">(опционально)</span>
        </label>
        <textarea
          id="description"
          {...register('description')}
          placeholder="Для чего будет использоваться этот workspace?"
          rows={3}
          className="w-full px-3 py-2 border rounded-lg"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex-1 px-4 py-2 border rounded-lg"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {isSubmitting ? 'Создание...' : 'Создать'}
        </button>
      </div>
    </form>
  )
}
```

---

## Заключение

Этот документ покрывает все аспекты реализации онбординга и создания первого workspace. Следуйте приоритетам, начинайте с Phase 1 (Core MVP), а затем добавляйте polish и nice-to-have features.

**Главная цель**: Сделать процесс создания первого workspace максимально простым и интуитивным, чтобы пользователь мог начать работу за < 1 минуту.

Удачи в разработке! 🚀




