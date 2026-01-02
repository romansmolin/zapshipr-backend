# Переменные окружения и скрипты

## Переменные окружения

Создайте файл `.env` в корне проекта со следующими переменными:

### База данных

```env
# Вариант 1: Connection string
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Вариант 2: Отдельные параметры
DB_HOST=localhost
DB_PORT=5432
DB_USER=app_user
DB_PASSWORD=app_password
DB_NAME=app_db
DB_SSL=false  # true для production с SSL
```

### Сервер

```env
PORT=4000  # Порт API сервера
```

### Аутентификация

```env
JWT_SECRET=your-secret-key-here  # Секрет для access token
JWT_REFRESH_SECRET=your-refresh-secret-key  # Секрет для refresh token
```

### Google OAuth

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### AWS S3

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name
```

### Redis (для BullMQ)

```env
REDIS_URL=redis://localhost:6379
# или
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # опционально
```

### Email (если используется)

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
```

## Скрипты

### Development

```bash
# Запуск API сервера в dev режиме (с hot reload)
npm run dev

# Запуск воркеров в dev режиме
npm run worker:dev
```

### Production

```bash
# Сборка проекта
npm run build

# Запуск API сервера
npm start

# Запуск воркеров
npm run worker
```

### Утилиты

```bash
# Проверка кода линтером
npm run lint
```

## Рекомендации

1. **Никогда не коммитьте `.env` файл** — добавьте его в `.gitignore`
2. **Используйте разные секреты** для development и production
3. **Генерируйте сильные секреты** для JWT (минимум 32 символа)
4. **Настройте CORS** в `app.ts` для production доменов
5. **Используйте SSL** для БД в production (`DB_SSL=true`)

## Пример .env.example

Создайте `.env.example` файл с примерами (без реальных значений):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PORT=4000
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-in-production
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET_NAME=your-bucket
REDIS_URL=redis://localhost:6379
```

