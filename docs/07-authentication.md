# Аутентификация

## JWT (JSON Web Tokens)

Система использует два типа токенов:

### Access Token
- **Назначение**: Короткоживущий токен для доступа к API
- **Время жизни**: Несколько часов (настраивается)
- **Хранение**: HTTP-only cookie
- **Использование**: В каждом запросе к защищенным эндпоинтам

### Refresh Token
- **Назначение**: Долгоживущий токен для обновления access token
- **Время жизни**: Несколько дней/недель (настраивается)
- **Хранение**: HTTP-only cookie
- **Использование**: Endpoint `/auth/refresh` для получения нового access token

### Middleware

`src/middleware/auth.middleware.ts` проверяет наличие и валидность access token:
- Извлекает токен из cookie
- Верифицирует подпись
- Добавляет `userId` в `req.user` для использования в контроллерах

### Endpoints

- `POST /auth/sign-up` — регистрация
- `POST /auth/sign-in` — вход
- `POST /auth/refresh` — обновление токена
- `POST /auth/logout` — выход (очистка cookies)
- `GET /auth/me` — получение информации о текущем пользователе
- `PUT /auth/change-password` — смена пароля
- `POST /auth/forget-password` — восстановление пароля

## Google OAuth

### Процесс авторизации

1. Пользователь перенаправляется на Google OAuth
2. После авторизации Google перенаправляет на `/auth/callback/google?code=...`
3. Сервер обменивает код на токены
4. Получает информацию о пользователе из Google
5. Создает или находит пользователя в БД
6. Выдает JWT токены

### Интеграция

- **Библиотека**: `google-auth-library`
- **Конфигурация**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Callback URL**: Настраивается в Google Console

### Безопасность

- Пароли хешируются через `bcryptjs`
- Токены подписываются секретными ключами (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- HTTP-only cookies защищают от XSS атак
- CORS настроен для разрешенных доменов

