# Docker Setup для ZapShipr Backend

## 📦 Архитектура

Проект использует **multi-stage Dockerfile** для создания оптимизированных образов:

- **API Service** (`ghcr.io/romansmolin/zapshipr-backend-api`) - Express.js сервер
- **Worker Service** (`ghcr.io/romansmolin/zapshipr-backend-worker`) - BullMQ воркеры

## 🏗️ Build Stages

### 1. Base Stage
- Устанавливает production зависимости
- Очищает npm cache для минимального размера

### 2. Builder Stage  
- Устанавливает все зависимости (включая dev)
- Компилирует TypeScript → JavaScript
- Использует `tsc` и `tsc-alias` для path aliases

### 3. API Stage
- Копирует production зависимости
- Копирует скомпилированный код
- Запускает `node dist/server.js`
- Порт: **4000**

### 4. Worker Stage
- Копирует production зависимости  
- Копирует скомпилированный код
- Запускает `node dist/worker.js`
- Подключается к Redis для BullMQ

## 🚀 Локальный Build

### Build API образа:
```bash
docker build --target api -t zapshipr-backend-api:local .
```

### Build Worker образа:
```bash
docker build --target worker -t zapshipr-backend-worker:local .
```

### Build обоих образов:
```bash
docker build --target api -t zapshipr-backend-api:local . && \
docker build --target worker -t zapshipr-backend-worker:local .
```

## 🏃 Локальный Run

### Запустить API:
```bash
docker run -p 4000:4000 \
  --env-file .env \
  zapshipr-backend-api:local
```

### Запустить Worker:
```bash
docker run \
  --env-file .env \
  zapshipr-backend-worker:local
```

## 🔄 CI/CD (GitHub Actions)

Workflow автоматически запускается при push в ветку `main`:

1. ✅ Checkout code
2. 🔐 Login to GitHub Container Registry (GHCR)
3. 🏗️ Build API image
4. 🏗️ Build Worker image  
5. 📤 Push API image → `ghcr.io/romansmolin/zapshipr-backend-api:latest`
6. 📤 Push Worker image → `ghcr.io/romansmolin/zapshipr-backend-worker:latest`

## 🔑 Environment Variables

Оба контейнера требуют следующие переменные окружения:

### Database
- `DATABASE_URL` - PostgreSQL connection string

### Redis
- `REDIS_HOST`
- `REDIS_PORT`  
- `REDIS_PASSWORD` (optional)

### AWS S3
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET_NAME`

### OpenAI
- `OPENAI_API_KEY`

### JWT
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

### OAuth (для social connectors)
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `X_CLIENT_ID`, `X_CLIENT_SECRET`
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`
- `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`

## 🐳 Docker Compose (пример)

```yaml
version: '3.8'

services:
  api:
    image: ghcr.io/romansmolin/zapshipr-backend-api:latest
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      # ... остальные env vars
    depends_on:
      - postgres
      - redis

  worker:
    image: ghcr.io/romansmolin/zapshipr-backend-worker:latest
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      # ... остальные env vars
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: zapshipr
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 📊 Размеры образов

Благодаря multi-stage build и Alpine Linux:
- **Base Node.js Alpine**: ~150 MB
- **API Image**: ~200-250 MB (estimated)
- **Worker Image**: ~200-250 MB (estimated)

## 🔒 Безопасность

- ✅ Непривилегированный пользователь (`nodejs:1001`)
- ✅ Production-only зависимости в финальных образах
- ✅ Минимальная attack surface (Alpine Linux)
- ✅ `.dockerignore` исключает dev/test файлы

## 📝 Notes

- Образы публикуются автоматически при push в `main`
- Используется тег `latest` (можно добавить версионирование)
- Требуется настройка `GITHUB_TOKEN` с правами на packages:write

